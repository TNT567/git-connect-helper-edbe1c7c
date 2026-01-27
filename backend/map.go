package main

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

// --- 结构体定义 ---

type Relayer struct {
	PrivateKey *ecdsa.PrivateKey
	Address    common.Address
	Nonce      int64
	mu         sync.Mutex
}

type CommonResponse struct {
	Ok     bool   `json:"ok,omitempty"`
	Status string `json:"status,omitempty"`
	TxHash string `json:"txHash,omitempty"`
	Error  string `json:"error,omitempty"`
	Role   string `json:"role,omitempty"`
}

// 用于前端热力图的数据结构
type HeatmapPoint struct {
	Name  string    `json:"name"`
	Value []float64 `json:"value"` // [经度, 纬度, 权重]
}

var (
	ctx            = context.Background()
	rdb            *redis.Client
	client         *ethclient.Client
	relayers       []*Relayer
	relayerCounter uint64
	chainID        *big.Int
)

func main() {
	godotenv.Load()
	
	rdb = redis.NewClient(&redis.Options{Addr: os.Getenv("REDIS_ADDR")})
	
	var err error
	client, err = ethclient.Dial(os.Getenv("RPC_URL"))
	if err != nil {
		log.Fatalf("无法连接到 RPC: %v", err)
	}

	cidStr := os.Getenv("CHAIN_ID")
	cInt, _ := strconv.ParseInt(cidStr, 10, 64)
	chainID = big.NewInt(cInt)

	loadRelayers()

	router := mux.NewRouter()

	// 基础接口
	router.HandleFunc("/secret/get-binding", getBindingHandler).Methods("GET")
	router.HandleFunc("/secret/verify", verifyHandler).Methods("GET")
	router.HandleFunc("/relay/mint", mintHandler).Methods("POST")
	router.HandleFunc("/api/v1/stats/sales", statsHandler).Methods("GET")

	// 新增：热力图分布接口
	router.HandleFunc("/api/v1/analytics/distribution", distributionHandler).Methods("GET")

	fmt.Printf("[%s] 🚀 鲸鱼金库：热力图版已启动。监听端口 :8080\n", time.Now().Format("15:04:05"))
	log.Fatal(http.ListenAndServe(":8080", cors(router)))
}

// --- 新增：地理位置处理逻辑 ---

func distributionHandler(w http.ResponseWriter, r *http.Request) {
	// 1. 从 Redis 获取所有已记录的 IP
	ips, err := rdb.SMembers(ctx, "vault:reader_ips").Result()
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "无法读取数据"})
		return
	}

	var points []HeatmapPoint
	client := &http.Client{Timeout: 5 * time.Second}

	// 2. 将 IP 转换为经纬度 (实际生产环境建议缓存这些坐标到 Redis)
	for _, ip := range ips {
		// 跳过本地测试 IP
		if ip == "127.0.0.1" || strings.HasPrefix(ip, "192.168") { continue }

		// 使用 ip-api.com (免费版每分钟限制45次请求，正式环境建议用 MaxMind DB)
		resp, err := client.Get(fmt.Sprintf("http://ip-api.com/json/%s", ip))
		if err != nil { continue }
		
		var geo struct {
			Lat  float64 `json:"lat"`
			Lon  float64 `json:"lon"`
			City string  `json:"city"`
		}
		json.NewDecoder(resp.Body).Decode(&geo)
		resp.Body.Close()

		if geo.Lat != 0 {
			points = append(points, HeatmapPoint{
				Name:  geo.City,
				Value: []float64{geo.Lon, geo.Lat, 1}, // 1 表示权重
			})
		}
	}

	sendJSON(w, http.StatusOK, points)
}

// --- 以下为原有的逻辑函数 (保持不变) ---

func executeMintLegacy(destAddr string) (string, error) {
	for i := 0; i < len(relayers); i++ {
		idx := atomic.AddUint64(&relayerCounter, 1) % uint64(len(relayers))
		relayer := relayers[idx]
		relayer.mu.Lock()
		balance, _ := client.BalanceAt(ctx, relayer.Address, nil)
		if balance.Cmp(big.NewInt(10000000000000000)) < 0 { 
			relayer.mu.Unlock()
			continue
		}
		gasPrice, _ := client.SuggestGasPrice(ctx)
		methodID := common.FromHex("6a627842")
		paddedAddress := common.LeftPadBytes(common.HexToAddress(destAddr).Bytes(), 32)
		data := append(methodID, paddedAddress...)
		tx := types.NewTransaction(uint64(relayer.Nonce), common.HexToAddress(os.Getenv("CONTRACT_ADDR")), big.NewInt(0), uint64(250000), gasPrice, data)
		signedTx, _ := types.SignTx(tx, types.NewEIP155Signer(chainID), relayer.PrivateKey)
		err := client.SendTransaction(ctx, signedTx)
		if err != nil {
			if strings.Contains(err.Error(), "nonce too low") {
				n, _ := client.PendingNonceAt(ctx, relayer.Address)
				relayer.Nonce = int64(n)
			}
			relayer.mu.Unlock()
			continue 
		}
		relayer.Nonce++
		relayer.mu.Unlock()
		return signedTx.Hash().Hex(), nil
	}
	return "", fmt.Errorf("relay fail")
}

func mintHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { Dest string; CodeHash string }
	json.NewDecoder(r.Body).Decode(&req)
	clientIP := r.Header.Get("X-Forwarded-For")
	if clientIP == "" { clientIP = strings.Split(r.RemoteAddr, ":")[0] }

	removed, _ := rdb.SRem(ctx, "vault:codes:valid", req.CodeHash).Result()
	if removed == 0 {
		sendJSON(w, http.StatusForbidden, CommonResponse{Error: "invalid code"})
		return
	}

	txHash, err := executeMintLegacy(req.Dest)
	if err != nil {
		rdb.SAdd(ctx, "vault:codes:valid", req.CodeHash)
		sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: err.Error()})
		return
	}

	pipe := rdb.Pipeline()
	pipe.SAdd(ctx, "vault:codes:used", req.CodeHash)
	pipe.HIncrBy(ctx, "whale_vault:daily_mints", time.Now().Format("2006-01-02"), 1)
	pipe.SAdd(ctx, "vault:reader_ips", clientIP)
	pipe.Exec(ctx)

	fmt.Printf("✅ [成功] 目标: %s | IP: %s\n", req.Dest, clientIP)
	sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "submitted", TxHash: txHash})
}

func verifyHandler(w http.ResponseWriter, r *http.Request) {
	h := r.URL.Query().Get("codeHash")
	a := strings.ToLower(r.URL.Query().Get("address"))
	adminAddr := strings.ToLower(os.Getenv("ADMIN_ADDRESS"))
	if adminAddr != "" && a == adminAddr {
		sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "ADMIN", Role: "publisher"})
		return
	}
	isValid, _ := rdb.SIsMember(ctx, "vault:codes:valid", h).Result()
	if isValid {
		sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "VALID_READER", Role: "reader"})
		return
	}
	sendJSON(w, http.StatusForbidden, CommonResponse{Ok: false, Error: "INVALID_CODE"})
}

func getBindingHandler(w http.ResponseWriter, r *http.Request) {
	h := r.URL.Query().Get("codeHash")
	mapping, _ := rdb.HGetAll(ctx, "vault:bind:"+h).Result()
	sendJSON(w, http.StatusOK, map[string]string{"address": mapping["address"]})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	stats, _ := rdb.HGetAll(ctx, "whale_vault:daily_mints").Result()
	var keys []string
	for k := range stats { keys = append(keys, k) }
	sort.Strings(keys)
	type Data struct { Date string `json:"date"`; Sales int `json:"sales"` }
	var result []Data
	total := 0
	for _, k := range keys {
		c, _ := strconv.Atoi(stats[k])
		total += c
		result = append(result, Data{Date: k, Sales: total})
	}
	sendJSON(w, http.StatusOK, result)
}

func loadRelayers() {
	count, _ := strconv.Atoi(os.Getenv("RELAYER_COUNT"))
	for i := 0; i < count; i++ {
		keyHex := os.Getenv(fmt.Sprintf("PRIVATE_KEY_%d", i))
		if keyHex == "" { continue }
		priv, _ := crypto.HexToECDSA(keyHex)
		r := &Relayer{
			PrivateKey: priv,
			Address:    crypto.PubkeyToAddress(priv.PublicKey),
		}
		n, _ := client.PendingNonceAt(ctx, r.Address)
		r.Nonce = int64(n)
		relayers = append(relayers, r)
	}
}

func sendJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" { return }
		next.ServeHTTP(w, r)
	})
}
