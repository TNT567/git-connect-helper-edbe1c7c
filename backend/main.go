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

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

// --- 缁撴瀯浣撳畾涔?---

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
		log.Fatalf("RPC 杩炴帴澶辫触: %v", err)
	}

	cidStr := os.Getenv("CHAIN_ID")
	cInt, _ := strconv.ParseInt(cidStr, 10, 64)
	chainID = big.NewInt(cInt)

	loadRelayers()

	r := mux.NewRouter()
	r.HandleFunc("/secret/get-binding", getBindingHandler).Methods("GET")
	r.HandleFunc("/secret/verify", verifyHandler).Methods("GET")
	r.HandleFunc("/relay/mint", mintHandler).Methods("POST")
	r.HandleFunc("/api/v1/analytics/distribution", publisherOnly(distributionHandler)).Methods("GET")
	r.HandleFunc("/api/v1/stats/sales", publisherOnly(statsHandler)).Methods("GET")
	
	// 鏂板锛氬悗鍙伴〉闈㈣闂帶鍒舵帴鍙?	r.HandleFunc("/api/admin/check-access", checkAdminAccessHandler).Methods("GET")

	fmt.Println("馃殌 Whale Vault 鍚庣宸插惎鍔細鍑虹増绀剧壒鏉冮€昏緫宸查攣瀹氥€傜鍙?:8080")
	log.Fatal(http.ListenAndServe("0.0.0.0:8080", cors(r)))
}

// --- 鏂板锛氬嚭鐗堢ぞ璁块棶鎺у埗涓棿浠?---

func publisherOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 浠庢煡璇㈠弬鏁拌幏鍙栧湴鍧€
		address := r.URL.Query().Get("address")
		if address == "" {
			// 灏濊瘯浠?Authorization header 鑾峰彇
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				address = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}
		
		if address == "" {
			sendJSON(w, http.StatusUnauthorized, CommonResponse{
				Error: "闇€瑕佹彁渚涢挶鍖呭湴鍧€杩涜楠岃瘉",
			})
			return
		}
		
		// 妫€鏌ユ槸鍚︽槸鍑虹増绀惧湴鍧€锛堝拷鐣ュぇ灏忓啓锛?		isPub, err := isPublisherAddress(address)
		if err != nil {
			sendJSON(w, http.StatusInternalServerError, CommonResponse{
				Error: "鏈嶅姟鍣ㄥ唴閮ㄩ敊璇?,
			})
			return
		}
		
		if !isPub {
			sendJSON(w, http.StatusForbidden, CommonResponse{
				Error: "浠呴檺鍑虹増绀捐闂鍔熻兘",
			})
			return
		}
		
		// 鏄嚭鐗堢ぞ锛岀户缁鐞?		next(w, r)
	}
}

// --- 鏂板锛氭鏌ユ槸鍚︽槸鍑虹増绀惧湴鍧€锛堝拷鐣ュぇ灏忓啓锛?---

func isPublisherAddress(address string) (bool, error) {
	members, err := rdb.SMembers(ctx, "vault:roles:publishers").Result()
	if err != nil {
		return false, err
	}
	
	lowerAddr := strings.ToLower(address)
	for _, member := range members {
		if strings.ToLower(member) == lowerAddr {
			return true, nil
		}
	}
	return false, nil
}

// --- 鏂板锛氬悗鍙拌闂鏌ユ帴鍙?---

func checkAdminAccessHandler(w http.ResponseWriter, r *http.Request) {
	address := r.URL.Query().Get("address")
	if address == "" {
		sendJSON(w, http.StatusBadRequest, CommonResponse{
			Error: "闇€瑕佹彁渚涢挶鍖呭湴鍧€",
		})
		return
	}
	
	// 妫€鏌ユ槸鍚︽槸鍑虹増绀惧湴鍧€
	isPub, err := isPublisherAddress(address)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, CommonResponse{
			Error: "鏈嶅姟鍣ㄥ唴閮ㄩ敊璇?,
		})
		return
	}
	
	if !isPub {
		sendJSON(w, http.StatusForbidden, CommonResponse{
			Error: "浠呴檺鍑虹増绀捐闂悗鍙?,
		})
		return
	}
	
	// 杩橀渶瑕佹鏌ユ槸鍚︿娇鐢ㄤ簡鏈夋晥鐨勬縺娲荤爜锛堝彲閫夛級
	// 杩欓噷鍙互娣诲姞婵€娲荤爜楠岃瘉閫昏緫
	
	sendJSON(w, http.StatusOK, CommonResponse{
		Ok:   true,
		Role: "publisher",
	})
}

// --- 鏍稿績淇閫昏緫 ---

func mintHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Dest     string `json:"dest"`
		CodeHash string `json:"codeHash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "鍙傛暟鏍煎紡閿欒"})
		return
	}
	
	destAddr := strings.ToLower(req.Dest)

	// 銆愮涓€姝ワ細鍖哄垎鍑虹増绀炬縺娲荤爜鍜屾櫘閫氭縺娲荤爜銆?	// 妫€鏌ユ槸鍚︽槸鍑虹増绀炬縺娲荤爜锛堜互"pub_"寮€澶达級
	if strings.HasPrefix(req.CodeHash, "pub_") {
		// 楠岃瘉鍑虹増绀炬縺娲荤爜鏄惁鏈夋晥
		isValid, _ := rdb.SIsMember(ctx, "vault:codes:valid", req.CodeHash).Result()
		if !isValid {
			sendJSON(w, http.StatusForbidden, CommonResponse{Error: "鏃犳晥鐨勫嚭鐗堢ぞ鍏戞崲鐮?})
			return
		}
		
		// 妫€鏌ュ湴鍧€鏄惁鏄嚭鐗堢ぞ鍦板潃锛堜娇鐢ㄦ柊鐨勫嚱鏁帮級
		isPub, err := isPublisherAddress(destAddr)
		if err != nil {
			sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "鏈嶅姟鍣ㄥ唴閮ㄩ敊璇?})
			return
		}
		
		if !isPub {
			sendJSON(w, http.StatusForbidden, CommonResponse{Error: "姝ゅ厬鎹㈢爜浠呴檺鍑虹増绀句娇鐢?})
			return
		}
		
		// 鍑虹増绀炬縺娲荤爜浣跨敤鍚庝笉鍒犻櫎锛屼繚鎸佹湁鏁?		// 鍙互灏嗕娇鐢ㄨ褰曡褰曞埌鍙︿竴涓泦鍚堬紝浣嗕笉鍦ㄤ富闆嗗悎涓垹闄?		rdb.SAdd(ctx, "vault:codes:used:publishers", req.CodeHash+":"+destAddr)
		
		fmt.Printf("鍑虹増绀捐闂垚鍔? %s, 婵€娲荤爜: %s銆傝烦杞埌鍚庡彴椤甸潰銆俓n", destAddr, req.CodeHash)
		sendJSON(w, http.StatusOK, CommonResponse{
			Ok:     true,
			Status: "PUBLISHER_WELCOME",
			Role:   "publisher",
		})
		return
	}
	
	// 銆愮浜屾锛氭鏌ユ槸鍚︿负鍑虹増绀惧湴鍧€锛堜娇鐢ㄦ櫘閫氭縺娲荤爜鐨勬儏鍐碉級銆?	isPub, err := isPublisherAddress(destAddr)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "鏈嶅姟鍣ㄥ唴閮ㄩ敊璇?})
		return
	}
	
	if isPub {
		// 鍑虹増绀句娇鐢ㄦ櫘閫氭縺娲荤爜锛岀洿鎺ヨ繑鍥炴垚鍔燂紝涓嶆墽琛孧int锛屾縺娲荤爜澶辨晥
		removed, _ := rdb.SRem(ctx, "vault:codes:valid", req.CodeHash).Result()
		if removed == 0 {
			sendJSON(w, http.StatusForbidden, CommonResponse{Error: "鏉冮檺楠岃瘉澶辫触锛氭棤鏁堢殑鍏戞崲鐮佹垨宸茶浣跨敤"})
			return
		}
		
		fmt.Printf("鍑虹増绀句娇鐢ㄦ櫘閫氭縺娲荤爜: %s, 婵€娲荤爜: %s銆傝烦杞埌鍚庡彴椤甸潰銆俓n", destAddr, req.CodeHash)
		sendJSON(w, http.StatusOK, CommonResponse{
			Ok:     true,
			Status: "PUBLISHER_WELCOME",
			Role:   "publisher",
		})
		return
	}

	// 銆愮涓夋锛氳鑰呴€昏緫銆戜笉鏄嚭鐗堢ぞ锛屾墠闇€瑕佹牳閿€婵€娲荤爜骞舵墽琛孧int
	removed, _ := rdb.SRem(ctx, "vault:codes:valid", req.CodeHash).Result()
	if removed == 0 {
		sendJSON(w, http.StatusForbidden, CommonResponse{Error: "鏉冮檺楠岃瘉澶辫触锛氭棤鏁堢殑鍏戞崲鐮佹垨宸茶浣跨敤"})
		return
	}

	// 銆愮鍥涙锛氭墽琛岃鑰?Mint銆?	txHash, err := executeMintLegacy(destAddr)
	if err != nil {
		rdb.SAdd(ctx, "vault:codes:valid", req.CodeHash) // 澶辫触鍥炴粴
		sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "閾句笂纭潈澶辫触: " + err.Error()})
		return
	}

	sendJSON(w, http.StatusOK, CommonResponse{
		Ok:     true,
		Status: "SUCCESS",
		TxHash: txHash,
		Role:   "reader",
	})
}

func verifyHandler(w http.ResponseWriter, r *http.Request) {
	a := r.URL.Query().Get("address")
	h := r.URL.Query().Get("codeHash")
	
	if a == "" {
		sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "闇€瑕佹彁渚涘湴鍧€鍙傛暟"})
		return
	}

	// 浼樺厛鍒ゅ畾鍑虹増绀撅紙浣跨敤鏂扮殑鍑芥暟锛?	isPub, _ := isPublisherAddress(a)
	if isPub {
		// 妫€鏌ユ槸鍚︽槸鍑虹増绀句笓鐢ㄦ縺娲荤爜
		if strings.HasPrefix(h, "pub_") {
			// 楠岃瘉鍑虹増绀炬縺娲荤爜鏄惁鏈夋晥
			isValid, _ := rdb.SIsMember(ctx, "vault:codes:valid", h).Result()
			if isValid {
				sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Role: "publisher"})
				return
			}
		} else {
			// 鍑虹増绀句娇鐢ㄦ櫘閫氭縺娲荤爜涔熷厑璁搁獙璇侀€氳繃
			// 浣嗗疄闄呬娇鐢ㄦ椂浼氬湪mintHandler涓秷鑰?			sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Role: "publisher"})
			return
		}
	}

	// 鍒ゅ畾浣滆€咃紙蹇界暐澶у皬鍐欙級
	members, _ := rdb.SMembers(ctx, "vault:roles:authors").Result()
	isAuthor := false
	for _, member := range members {
		if strings.ToLower(member) == strings.ToLower(a) {
			isAuthor = true
			break
		}
	}
	
	if isAuthor {
		sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Role: "author"})
		return
	}

	// 璇昏€呴獙璇佹縺娲荤爜姹?	isValid, _ := rdb.SIsMember(ctx, "vault:codes:valid", h).Result()
	if isValid {
		sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Role: "reader"})
	} else {
		sendJSON(w, http.StatusForbidden, CommonResponse{Error: "INVALID_CODE"})
	}
}

// --- 杈呭姪鍑芥暟 ---

func executeMintLegacy(toAddr string) (string, error) {
	idx := atomic.AddUint64(&relayerCounter, 1) % uint64(len(relayers))
	r := relayers[idx]
	r.mu.Lock()
	defer r.mu.Unlock()

	gasPrice, _ := client.SuggestGasPrice(ctx)
	tx := types.NewTransaction(uint64(r.Nonce), common.HexToAddress(toAddr), big.NewInt(0), 21000, gasPrice, nil)
	signedTx, _ := types.SignTx(tx, types.NewEIP155Signer(chainID), r.PrivateKey)
	
	if err := client.SendTransaction(ctx, signedTx); err != nil {
		return "", err
	}
	r.Nonce++
	return signedTx.Hash().Hex(), nil
}

func getBindingHandler(w http.ResponseWriter, r *http.Request) {
	h := r.URL.Query().Get("codeHash")
	addr, _ := rdb.HGet(ctx, "vault:bind:"+h, "address").Result()
	sendJSON(w, http.StatusOK, map[string]string{"address": addr})
}

func distributionHandler(w http.ResponseWriter, r *http.Request) {
	data := []map[string]interface{}{
		{"name": "Beijing", "value": []float64{116.46, 39.92, 10}},
	}
	sendJSON(w, http.StatusOK, data)
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

func cors(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" { return }
		h.ServeHTTP(w, r)
	})
}

func sendJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
