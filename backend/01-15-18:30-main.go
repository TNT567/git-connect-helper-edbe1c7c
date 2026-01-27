package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
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

var (
	ctx                = context.Background()
	rdb                *redis.Client
	client             *ethclient.Client
	relayerPrivateKeys []string // 20个并行钱包私钥
	relayerCounter     uint64   // 原子计数器用于轮询
)

type CommonResponse struct {
	Ok     bool   `json:"ok,omitempty"`
	Status string `json:"status,omitempty"`
	TxHash string `json:"txHash,omitempty"`
	Error  string `json:"error,omitempty"`
	Role   string `json:"role,omitempty"` // 关键字段：用于前端判断是否跳转管理页
}

type ChartData struct {
	Date  string `json:"date"`
	Sales int    `json:"sales"`
}

func main() {
	godotenv.Load()
	rdb = redis.NewClient(&redis.Options{Addr: os.Getenv("REDIS_ADDR")})
	
	var err error
	client, err = ethclient.Dial(os.Getenv("RPC_URL"))
	if err != nil {
		log.Fatalf("无法连接到 RPC: %v", err)
	}

	// 加载 20 个并行中继钱包配置
	loadRelayers()

	router := mux.NewRouter()

	// --- 路由 1: 秘密验证接口 (严格 Redis + 出版社地址校验) ---
	router.HandleFunc("/secret/verify", func(w http.ResponseWriter, r *http.Request) {
		h := r.URL.Query().Get("codeHash")
		a := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("address")))
		
		// 从环境变量读取出版社指定的钱包地址
		adminAddr := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_ADDRESS")))

		fmt.Printf("\n[DEBUG] 收到请求: Hash=[%s] Addr=[%s]\n", h, a)

		// 第一步：去 Redis 查询该 Hash 是否为有效码
		isValid, _ := rdb.SIsMember(ctx, "vault:codes:valid", h).Result()

		if isValid {
			// 第二步：如果 Hash 有效，判断地址是否为出版社地址
			if adminAddr != "" && a == adminAddr {
				fmt.Println("🎯 匹配成功：合法 Hash + 出版社地址 -> 授予管理权限")
				sendJSON(w, http.StatusOK, CommonResponse{
					Ok:     true, 
					Status: "ADMIN_ACCESS", 
					Role:   "publisher", // 触发前端 Success.tsx 跳转
				})
				return
			}
			
			// 普通读者逻辑
			fmt.Println("📖 匹配结果：合法 Hash + 普通读者地址")
			sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "READER_ACCESS"})
			return
		}

		// Hash 不在 Redis 中
		fmt.Println("❌ 匹配失败：无效或不存在的 Hash Code")
		sendJSON(w, http.StatusForbidden, CommonResponse{Ok: false, Error: "INVALID"})
	}).Methods("GET")

	// --- 路由 2: 链上并行铸造接口 ---
	router.HandleFunc("/relay/mint", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Dest     string `json:"dest"`
			CodeHash string `json:"codeHash"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "参数错误"})
			return
		}

		valid, _ := rdb.SIsMember(ctx, "vault:codes:valid", req.CodeHash).Result()
		if !valid {
			sendJSON(w, http.StatusForbidden, CommonResponse{Error: "兑换码无效"})
			return
		}

		// 使用轮询池执行并行 Mint
		txHash, err := executeMintParallel(req.Dest)
		if err != nil {
			sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "铸造失败"})
			return
		}

		// 原子更新数据状态
		pipe := rdb.Pipeline()
		pipe.SRem(ctx, "vault:codes:valid", req.CodeHash)
		pipe.SAdd(ctx, "vault:codes:used", req.CodeHash)
		pipe.Set(ctx, "bind:"+req.CodeHash, req.Dest, 0) 
		pipe.HIncrBy(ctx, "whale_vault:daily_mints", time.Now().Format("2006-01-02"), 1)
		pipe.Exec(ctx)

		go notifyMatrix(req.Dest, txHash) // 异步通知群聊
		sendJSON(w, http.StatusOK, CommonResponse{Status: "submitted", TxHash: txHash})
	}).Methods("POST")

	// --- 路由 3: 销量统计接口 ---
	router.HandleFunc("/api/v1/stats/sales", func(w http.ResponseWriter, r *http.Request) {
		stats, _ := rdb.HGetAll(ctx, "whale_vault:daily_mints").Result()
		var items []struct{ date string; count int }
		for d, cStr := range stats {
			c, _ := strconv.Atoi(cStr)
			items = append(items, struct{ date string; count int }{d, c})
		}
		sort.Slice(items, func(i, j int) bool { return items[i].date < items[j].date })

		var responseData []ChartData
		total := 0
		for _, item := range items {
			total += item.count
			responseData = append(responseData, ChartData{Date: item.date, Sales: total})
		}
		sendJSON(w, http.StatusOK, responseData)
	}).Methods("GET")

	fmt.Printf("[%s] 🚀 鲸鱼金库：管理员跳转与并行中继功能已就绪 :8080\n", time.Now().Format("15:04:05"))
	http.ListenAndServe(":8080", cors(router))

// --- 新增：查询码绑定的钱包地址 ---
router.HandleFunc("/secret/get-binding", func(w http.ResponseWriter, r *http.Request) {
    h := r.URL.Query().Get("codeHash")
    
    // 从 Redis Hash 中获取绑定信息
    mapping, err := rdb.HGetAll(ctx, "vault:bind:"+h).Result()
    if err != nil || len(mapping) == 0 {
        sendJSON(w, http.StatusNotFound, CommonResponse{Error: "未找到绑定地址"})
        return
    }

    // 只返回地址，不返回私钥（安全第一）
    sendJSON(w, http.StatusOK, map[string]string{
        "address": mapping["address"],
    })
}).Methods("GET")




}

// 并行执行逻辑：Round Robin 轮询 20 个钱包
func executeMintParallel(destAddr string) (string, error) {
	idx := atomic.AddUint64(&relayerCounter, 1) % uint64(len(relayerPrivateKeys))
	selectedKey := relayerPrivateKeys[idx]

	privateKey, _ := crypto.HexToECDSA(selectedKey)
	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)
	nonce, _ := client.PendingNonceAt(ctx, fromAddress)
	gasPrice, _ := client.SuggestGasPrice(ctx)
	chainID, _ := strconv.ParseInt(os.Getenv("CHAIN_ID"), 10, 64)

	// 构造智能合约调用数据
	data := append(common.FromHex("6a627842"), common.LeftPadBytes(common.HexToAddress(destAddr).Bytes(), 32)...)
	tx := types.NewTransaction(nonce, common.HexToAddress(os.Getenv("CONTRACT_ADDR")), big.NewInt(0), 200000, gasPrice, data)
	signedTx, _ := types.SignTx(tx, types.NewEIP155Signer(big.NewInt(chainID)), privateKey)
	
	err := client.SendTransaction(ctx, signedTx)
	if err == nil {
		fmt.Printf("✅ Relayer #%d (Address: %s) 发送成功\n", idx, fromAddress.Hex())
	}
	return signedTx.Hash().Hex(), err
}

func loadRelayers() {
	count, _ := strconv.Atoi(os.Getenv("RELAYER_COUNT"))
	for i := 0; i < count; i++ {
		key := os.Getenv(fmt.Sprintf("PRIVATE_KEY_%d", i))
		if key != "" {
			relayerPrivateKeys = append(relayerPrivateKeys, key)
		}
	}
	fmt.Printf("Loaded %d parallel relayers from .env\n", len(relayerPrivateKeys))
}

func notifyMatrix(dest, txHash string) {
	msg := fmt.Sprintf("🎉 鲸鱼金库：新 NFT 铸造！\n地址: %s\n哈希: %s", dest, txHash)
	url := fmt.Sprintf("%s/_matrix/client/r0/rooms/%s/send/m.room.message?access_token=%s", 
		os.Getenv("MATRIX_URL"), os.Getenv("MATRIX_ROOM_ID"), os.Getenv("MATRIX_ACCESS_TOKEN"))
	payload, _ := json.Marshal(map[string]interface{}{"msgtype": "m.text", "body": msg})
	http.Post(url, "application/json", bytes.NewBuffer(payload))
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
