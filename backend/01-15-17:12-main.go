package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
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
	relayerPrivateKeys []string 
	relayerCounter     uint64   
)

type CommonResponse struct {
	Ok     bool   `json:"ok,omitempty"`
	Status string `json:"status,omitempty"`
	TxHash string `json:"txHash,omitempty"`
	Error  string `json:"error,omitempty"`
	Role   string `json:"role,omitempty"`
}

func main() {
	godotenv.Load()
	rdb = redis.NewClient(&redis.Options{Addr: os.Getenv("REDIS_ADDR")})
	
	var err error
	client, err = ethclient.Dial(os.Getenv("RPC_URL"))
	if err != nil {
		log.Fatal(err)
	}

	loadRelayers()
	fmt.Printf("Relayer Pool Active: %d addresses\n", len(relayerPrivateKeys))

	router := mux.NewRouter()

	router.HandleFunc("/secret/verify", func(w http.ResponseWriter, r *http.Request) {
		codeHash := r.URL.Query().Get("codeHash")
		address := strings.ToLower(r.URL.Query().Get("address"))
		adminHash := os.Getenv("ADMIN_CODE_HASH")
		adminAddr := strings.ToLower(os.Getenv("ADMIN_ADDRESS"))

		if codeHash == adminHash && address == adminAddr {
			sendJSON(w, http.StatusOK, CommonResponse{Ok: true, Status: "ADMIN_ACCESS", Role: "publisher"})
			return
		}
		sendJSON(w, http.StatusOK, CommonResponse{Ok: true})
	}).Methods("GET")

	router.HandleFunc("/relay/mint", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Dest     string `json:"dest"`
			CodeHash string `json:"codeHash"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		txHash, err := executeMintParallel(req.Dest)
		if err != nil {
			sendJSON(w, 500, CommonResponse{Error: "Mint Failed"})
			return
		}

		rdb.HIncrBy(ctx, "whale_vault:daily_mints", time.Now().Format("2006-01-02"), 1)
		sendJSON(w, 200, CommonResponse{Status: "submitted", TxHash: txHash})
	}).Methods("POST")

	fmt.Println("Backend starting on :8080")
	http.ListenAndServe(":8080", cors(router))
}

func executeMintParallel(destAddr string) (string, error) {
	idx := atomic.AddUint64(&relayerCounter, 1) % uint64(len(relayerPrivateKeys))
	selectedKey := relayerPrivateKeys[idx]
	privateKey, _ := crypto.HexToECDSA(selectedKey)
	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)
	nonce, _ := client.PendingNonceAt(ctx, fromAddress)
	gasPrice, _ := client.SuggestGasPrice(ctx)
	chainID, _ := strconv.ParseInt(os.Getenv("CHAIN_ID"), 10, 64)

	data := append(common.FromHex("6a627842"), common.LeftPadBytes(common.HexToAddress(destAddr).Bytes(), 32)...)
	tx := types.NewTransaction(nonce, common.HexToAddress(os.Getenv("CONTRACT_ADDR")), big.NewInt(0), 200000, gasPrice, data)
	signedTx, _ := types.SignTx(tx, types.NewEIP155Signer(big.NewInt(chainID)), privateKey)
	err := client.SendTransaction(ctx, signedTx)
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
