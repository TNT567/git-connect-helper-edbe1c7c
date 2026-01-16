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

// Relayer 结构体：管理子钱包的私钥、地址和本地 Nonce
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

	// 初始化 ChainID (例如 Monad: 10143)
	cidStr := os.Getenv("CHAIN_ID")
	cInt, _ := strconv.ParseInt(cidStr, 10, 64)
	chainID = big.NewInt(cInt)

	// 加载并同步所有子钱包
	loadRelayers()

	router := mux.NewRouter()

	// 基础接口
	router.HandleFunc("/secret/get-binding", getBindingHandler).Methods("GET")
	router.HandleFunc("/secret/verify", verifyHandler).Methods("GET")
	router.HandleFunc("/relay/mint", mintHandler).Methods("POST")
	router.HandleFunc("/api/v1/stats/sales", statsHandler).Methods("GET")

	fmt.Printf("[%s] 🚀 鲸鱼金库：完整功能版已启动。监听端口 :8080\n", time.Now().Format("15:04:05"))
	fmt.Printf("当前已加载子钱包数量: %d\n", len(relayers))
	log.Fatal(http.ListenAndServe(":8080", cors(router)))
}

// --- 核心逻辑：带余额检查的智能轮询 + IP 记录 ---

func executeMintLegacy(destAddr string) (string, error) {
	// 最多尝试所有钱包一遍
	for i := 0; i < len(relayers); i++ {
		idx := atomic.AddUint64(&relayerCounter, 1) % uint64(len(relayers))
		relayer := relayers[idx]

		relayer.mu.Lock()

		// 1. 检查余额：如果低于 0.01 MON，跳过换下一个
		balance, _ := client.BalanceAt(ctx, relayer.Address, nil)
		if balance.Cmp(big.NewInt(10000000000000000)) < 0 { 
			fmt.Printf("⚠️  [Relayer #%d] 余额不足 (%s)，尝试下一个...\n", idx, relayer.Address.Hex())
			relayer.mu.Unlock()
			continue
		}

		gasPrice, err := client.SuggestGasPrice(ctx)
		if err != nil {
			relayer.mu.Unlock()
			return "", err
		}

		// 2. 构造交易
		methodID := common.FromHex("6a627842") // mint(address)
		paddedAddress := common.LeftPadBytes(common.HexToAddress(destAddr).Bytes(), 32)
		data := append(methodID, paddedAddress...)

		tx := types.NewTransaction(
			uint64(relayer.Nonce),
			common.HexToAddress(os.Getenv("CONTRACT_ADDR")),
			big.NewInt(0),
			uint64(250000), 
			gasPrice,
			data,
		)

		signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), relayer.PrivateKey)
		if err != nil {
			relayer.mu.Unlock()
			return "", err
		}

		// 3. 发送交易
		err = client.SendTransaction(ctx, signedTx)
		if err != nil {
			if strings.Contains(err.Error(), "nonce too low") {
				n, _ := client.PendingNonceAt(ctx, relayer.Address)
				relayer.Nonce = int64(n)
			}
			relayer.mu.Unlock()
			fmt.Printf("❌ [Relayer #%d] 发送失败: %v\n", idx, err)
			continue 
		}

		relayer.Nonce++
		relayer.mu.Unlock()
		return signedTx.Hash().Hex(), nil
	}

	return "", fmt.Errorf("所有子钱包均余额不足或发送失败")
}

// --- Handler 函数 ---

func mintHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Dest     string `json:"dest"`
		CodeHash string `json:"codeHash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "参数错误"})
		return
	}

	// 获取客户端 IP
	clientIP := r.Header.Get("X-Forwarded-For")
	if clientIP == "" { clientIP = r.Header.Get("X-Real-IP") }
	if clientIP == "" { clientIP = strings.Split(r.RemoteAddr, ":")[0] }

	// 原子化销毁有效码
	removed, _ := rdb.SRem(ctx, "vault:codes:valid", req.CodeHash).Result()
	if removed == 0 {
		sendJSON(w, http.StatusForbidden, CommonResponse{Error: "此码已失效或已领取"})
		return
	}

	txHash, err := executeMintLegacy(req.Dest)
	if err != nil {
		rdb.SAdd(ctx, "vault:codes:valid", req.CodeHash) // 失败归还码
		sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: err.Error()})
		return
	}

	// 成功后：记录 IP、销量和使用状态
	pipe := rdb.Pipeline()
	pipe.SAdd(ctx, "vault:codes:used", req.CodeHash)
	pipe.HIncrBy(ctx, "whale_vault:daily_mints", time.Now().Format("2006-01-02"), 1)
	
	// 记录 Mint 详情
	mintDetail := map[string]interface{}{
		"ip":      clientIP,
		"address": req.Dest,
		"time":    time.Now().Format(time.RFC3339),
	}
	pipe.HSet(ctx, "vault:mint_info:"+req.CodeHash, mintDetail)
	pipe.SAdd(ctx, "vault:reader_ips", clientIP)
	pipe.Exec(ctx)

	fmt.Printf("✅ [成功] 目标: %s | IP: %s | Tx: %s\n", req.Dest, clientIP, txHash)
	sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "submitted", TxHash: txHash})
}

func verifyHandler(w http.ResponseWriter, r *http.Request) {
	h := r.URL.Query().Get("codeHash")
	a := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("address")))
	adminAddr := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_ADDRESS")))

	// 1. 出版社管理员判定
	if adminAddr != "" && a == adminAddr {
		sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "ADMIN", Role: "publisher"})
		return
	}

	// 2. 作者判定 (从 Redis 集合 vault:authors 中读取)
	isAuthor, _ := rdb.SIsMember(ctx, "vault:authors", a).Result()
	if isAuthor {
		sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "AUTHOR", Role: "author"})
		return
	}

	// 3. 合法读者判定
	isValid, _ := rdb.SIsMember(ctx, "vault:codes:valid", h).Result()
	if isValid {
		sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "VALID_READER", Role: "reader"})
		return
	}

	sendJSON(w, http.StatusForbidden, CommonResponse{Ok: false, Error: "INVALID_CODE"})
}

func getBindingHandler(w http.ResponseWriter, r *http.Request) {
	h := r.URL.Query().Get("codeHash")
	mapping, err := rdb.HGetAll(ctx, "vault:bind:"+h).Result()
	if err != nil || len(mapping) == 0 {
		sendJSON(w, http.StatusOK, map[string]string{"address": ""})
		return
	}
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
