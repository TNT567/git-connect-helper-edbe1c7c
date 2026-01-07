package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"
)

type RelayRequest struct {
	Dest                 string  `json:"dest"`
	Value                string  `json:"value"`
	GasLimit             string  `json:"gasLimit"`
	StorageDepositLimit  *string `json:"storageDepositLimit"`
	DataHex              string  `json:"dataHex"`
	Signer               string  `json:"signer"`
}

type RelayResponse struct {
	Status string `json:"status"`
	TxHash string `json:"txHash,omitempty"`
	Error  string `json:"error,omitempty"`
}

type Limiter struct {
	mu       sync.Mutex
	visitors map[string]*rate.Limiter
}

func NewLimiter() *Limiter {
	return &Limiter{visitors: make(map[string]*rate.Limiter)}
}

func (l *Limiter) get(ip string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()
	if lim, ok := l.visitors[ip]; ok {
		return lim
	}
	lim := rate.NewLimiter(rate.Every(2*time.Second), 3)
	l.visitors[ip] = lim
	return lim
}

func main() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "127.0.0.1:6379"
	}

	limiter := NewLimiter()
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
	ctx := context.Background()

	router := mux.NewRouter()
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})
	router.HandleFunc("/relay/mint", func(w http.ResponseWriter, r *http.Request) {
		ip := r.Header.Get("X-Forwarded-For")
		if ip == "" {
			ip = r.RemoteAddr
		}
		// Check ban
		banned, _ := rdb.Exists(ctx, "ban:"+ip).Result()
		if banned > 0 {
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(RelayResponse{Status: "error", Error: "ip banned"})
			return
		}
		if !limiter.get(ip).Allow() {
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(RelayResponse{Status: "error", Error: "rate limited"})
			return
		}

		var req RelayRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(RelayResponse{Status: "error", Error: "invalid json"})
			return
		}

		txHash := fmt.Sprintf("0x%x", time.Now().UnixNano())
		rdb.Del(ctx, "fail:"+ip)
		logEntry := map[string]any{
			"timestamp": time.Now().Unix(),
			"tx_hash":   txHash,
			"book_id":   r.URL.Query().Get("book_id"),
		}
		b, _ := json.Marshal(logEntry)
		rdb.LPush(ctx, "mint:logs", b)
		rdb.LTrim(ctx, "mint:logs", 0, 999)

		json.NewEncoder(w).Encode(RelayResponse{Status: "submitted", TxHash: txHash})
	}).Methods("POST")

	// Metrics endpoint for frontend
	router.HandleFunc("/metrics/mint", func(w http.ResponseWriter, r *http.Request) {
		limit := int64(50)
		vals, err := rdb.LRange(ctx, "mint:logs", 0, limit-1).Result()
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`[]`))
			return
		}
		var out []map[string]any
		for _, v := range vals {
			var m map[string]any
			if json.Unmarshal([]byte(v), &m) == nil {
				out = append(out, m)
			}
		}
		json.NewEncoder(w).Encode(out)
	}).Methods("GET")

	addr := ":8080"
	log.Printf("Relay server listening on %s", addr)
	http.ListenAndServe(addr, router)
}
