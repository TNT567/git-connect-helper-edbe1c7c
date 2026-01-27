package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"github.com/redis/go-redis/v9"
)

type MarketHandler struct {
	RDB *redis.Client
}

// BookMeta 定义书籍的元数据结构
type BookMeta struct {
	Symbol  string            `json:"symbol"`
	Name    map[string]string `json:"name"`   // 支持多语言
	Author  map[string]string `json:"author"`
	Address string            `json:"address"`
	Sales   int64             `json:"sales"`
	Change  string            `json:"change"`
}

// GetTickers 获取海量书籍大盘（支持分页）
func (h *MarketHandler) GetTickers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	// 1. 获取分页参数
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 { page = 1 }
	pageSize := int64(50)
	start := int64(page-1) * pageSize
	stop := start + pageSize - 1

	// 2. 从 Redis ZSet 获取排名
	// vault:tickers:sales 存储了书籍地址和对应的销量（Score）
	addresses, err := h.RDB.ZRevRange(ctx, "vault:tickers:sales", start, stop).Result()
	if err != nil {
		http.Error(w, "Redis lookup failed", 500)
		return
	}

	// 3. 从 Redis Hash 批量获取详情
	var result []BookMeta
	for _, addr := range addresses {
		data, _ := h.RDB.HGet(ctx, "vault:books:registry", addr).Result()
		var b BookMeta
		json.Unmarshal([]byte(data), &b)
		result = append(result, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
