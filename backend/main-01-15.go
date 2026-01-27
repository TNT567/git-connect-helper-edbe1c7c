package main

import (
	"fmt"
	"os"
	"strings"
	"github.com/gin-gonic/gin"
)

func main() {
	// 强制设置 Gin 为发布模式
	gin.SetMode(gin.ReleaseMode)
	r := gin.New() // 使用 New 而不是 Default，减少干扰

	// 🌟 物理级跨域补丁：手动接管所有 Header
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204) // 预检请求直接回 204
			return
		}
		c.Next()
	})

	// 1. 秘密验证接口
	r.GET("/secret/verify", func(c *gin.Context) {
		h := c.Query("codeHash")
		a := strings.ToLower(strings.TrimSpace(c.Query("address")))
		
		targetH := os.Getenv("ADMIN_CODE_HASH")
		targetA := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_ADDRESS")))

		// 终端回显：这是我们确权的关键
		fmt.Printf("\n[DEBUG] 收到请求: Hash=[%s] Addr=[%s]\n", h, a)
		fmt.Printf("[DEBUG] 目标比对: Hash=[%s] Addr=[%s]\n", targetH, targetA)

		if targetH != "" && h == targetH && a == targetA {
			fmt.Println("🎯 MATCH SUCCESS: ADMIN DETECTED")
			c.JSON(200, gin.H{"status": "ADMIN_ACCESS"})
		} else {
			fmt.Println("❌ MATCH FAILED: NORMAL USER")
			c.JSON(403, gin.H{"status": "FAIL"})
		}
	})

	// 2. 销量接口 (解决你看到的 200 循环)
	r.GET("/metrics/mint", func(c *gin.Context) {
		c.JSON(200, gin.H{"total_sales": 3070})
	})

	// 3. 模拟铸造
	r.POST("/relay/mint", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "submitted"})
	})

	fmt.Println("🚀 物理对齐后端已就绪，监听端口 :8080")
	r.Run("0.0.0.0:8080")
}
