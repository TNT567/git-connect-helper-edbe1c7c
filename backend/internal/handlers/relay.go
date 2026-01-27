package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/redis/go-redis/v9"
	"whale-vault/relay/internal/blockchain"
)

// RelayHandler 封装读者端依赖
type RelayHandler struct {
	RDB    *redis.Client
	Client *ethclient.Client
}

// CommonResponse 统一响应格式
type CommonResponse struct {
	Ok     bool   `json:"ok,omitempty"`
	Status string `json:"status,omitempty"`
	TxHash string `json:"txHash,omitempty"`
	Error  string `json:"error,omitempty"`
}

// SaveCode 处理书码校验与暂存
func (h *RelayHandler) SaveCode(w http.ResponseWriter, r *http.Request) {
	var codeHash string
	var address string

	if r.Method == http.MethodGet {
		codeHash = r.URL.Query().Get("codeHash")
		address = r.URL.Query().Get("address")
	} else {
		var req struct {
			CodeHash string `json:"codeHash"`
			Address  string `json:"address"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			codeHash = req.CodeHash
			address = req.Address
		}
	}

	codeHash = strings.ToLower(strings.TrimSpace(codeHash))
	address = strings.ToLower(strings.TrimSpace(address))

	if codeHash == "" {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "缺失书码哈希"})
		return
	}

	ctx := r.Context()
	isValid, err := h.RDB.SIsMember(ctx, "vault:codes:valid", codeHash).Result()
	if err != nil {
		h.sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "数据库连接异常"})
		return
	}

	if !isValid {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "无效的二维码：可能是盗版书，或已领取过 NFT"})
		return
	}

	var count int64 = 0
	if address != "" {
		addrKey := "vault:saved:" + address
		h.RDB.SAdd(ctx, addrKey, codeHash)
		count, _ = h.RDB.SCard(ctx, addrKey).Result()
	}

	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"message": "有效书码",
		"code":    codeHash,
		"count":   count,
	})
}

// GetSaved 获取用户已暂存的书码
func (h *RelayHandler) GetSaved(w http.ResponseWriter, r *http.Request) {
	addr := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("address")))
	if addr == "" {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "缺少 address 参数"})
		return
	}

	codes, _ := h.RDB.SMembers(r.Context(), "vault:saved:"+addr).Result()
	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":    true,
		"codes": codes,
	})
}

// GetReferrerStats 获取推荐人统计信息 (支持全量排行榜)
func (h *RelayHandler) GetReferrerStats(w http.ResponseWriter, r *http.Request) {
	addr := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("address")))
	ctx := r.Context()

	// 核心逻辑：如果地址为空，返回 Redis 中该 Hash 表的所有条目，即排行榜数据
	if addr == "" {
		stats, err := h.RDB.HGetAll(ctx, "whale_vault:referrer_stats").Result()
		if err != nil {
			log.Printf("读取排行榜失败: %v", err)
			h.sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "无法获取排行榜"})
			return
		}
		// 返回全量统计数据供前端排序
		h.sendJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "all_stats": stats})
		return
	}

	// 如果提供了地址，则返回该特定地址的推荐数
	count, err := h.RDB.HGet(ctx, "whale_vault:referrer_stats", addr).Result()
	if err == redis.Nil {
		count = "0"
	}

	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"address": addr,
		"count":   count,
	})
}

// Reward 执行最终的 5 码兑换合约调用
func (h *RelayHandler) Reward(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Dest  string   `json:"dest"`
		Codes []string `json:"codes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Codes) < 5 {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "请集齐 5 个有效书码"})
		return
	}

	initialBizHash := req.Codes[0]

	// 2. 调用合约 (带重试逻辑，解决 connection reset 问题)
	var txHash, finalBizHash string
	var err error
	for i := 0; i < 3; i++ {
		txHash, finalBizHash, err = blockchain.DispenseReward(
			h.Client,
			req.Dest,
			os.Getenv("BACKEND_PRIVATE_KEY"),
			initialBizHash,
			req.Codes,
		)
		if err == nil {
			break
		}
		if strings.Contains(err.Error(), "reset") || strings.Contains(err.Error(), "EOF") {
			log.Printf("⚠️ 网络重置 (第 %d 次重试): %v", i+1, err)
			time.Sleep(1 * time.Second)
			continue
		}
		break
	}

	if err != nil {
		log.Printf("合约调用失败: %v", err)
		h.sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "区块链交易失败: " + err.Error()})
		return
	}

	// 3. 链上成功后，清理 Redis 并更新统计 (使用 Pipeline 保证原子性)
	ctx := r.Context()
	pipe := h.RDB.Pipeline()
	cleanAddr := strings.ToLower(req.Dest)
	
	// A. 清理用户暂存列表
	pipe.Del(ctx, "vault:saved:"+cleanAddr)
	for _, c := range req.Codes {
		cClean := strings.ToLower(c)
		pipe.SRem(ctx, "vault:codes:valid", cClean)
		pipe.SAdd(ctx, "vault:codes:rewarded", cClean)
	}

	// B. 记录今日全网总销量
	pipe.HIncrBy(ctx, "whale_vault:daily_mints", time.Now().Format("2006-01-02"), 1)

	// C. 核心新增：递增该推荐人的成功总数
	pipe.HIncrBy(ctx, "whale_vault:referrer_stats", cleanAddr, 1)

	if _, err := pipe.Exec(ctx); err != nil {
		log.Printf("Redis 更新失败: %v", err)
	}

	h.sendJSON(w, http.StatusOK, CommonResponse{
		Ok:     true,
		Status: finalBizHash,
		TxHash: txHash,
	})
}

// sendJSON 辅助函数
func (h *RelayHandler) sendJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
