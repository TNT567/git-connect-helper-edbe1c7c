package main

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"os"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/joho/godotenv"
)

func main() {
	// 1. 加载环境变量 (不报错也继续，因为我们可能从命令行传入)
	_ = godotenv.Load()

	// 2. 核心调试：看看程序到底从系统里拿到了什么
	rawKey := os.Getenv("MAIN_PRIVATE_KEY")
	fmt.Printf("🔍 [DEBUG] 环境变量 MAIN_PRIVATE_KEY 长度: %d\n", len(rawKey))
	
	if rawKey == "" {
		log.Fatal("❌ 错误：未能获取到 MAIN_PRIVATE_KEY，请检查 .env 或 export 命令")
	}

	// 3. 解析私钥
	mainPrivateKey, err := crypto.HexToECDSA(rawKey)
	if err != nil {
		log.Fatalf("❌ [DEBUG] 私钥解析失败: %v", err)
	}
	
	fromAddress := crypto.PubkeyToAddress(mainPrivateKey.PublicKey)
	fmt.Printf("👛 [DEBUG] 识别到的签名地址: %s\n", fromAddress.Hex())

	// 4. 连接网络
	rpcUrl := strings.Split(os.Getenv("RPC_URL"), " ")[0]
	client, err := ethclient.Dial(rpcUrl)
	if err != nil {
		log.Fatal(err)
	}

	// 获取余额验证
	balance, _ := client.BalanceAt(context.Background(), fromAddress, nil)
	fmt.Printf("💰 [DEBUG] 该地址余额: %s wei\n", balance.String())

	// 5. 准备分发
	chainID, _ := client.ChainID(context.Background())
	nonce, _ := client.PendingNonceAt(context.Background(), fromAddress)
	amount, _ := new(big.Int).SetString("500000000000000000", 10) // 0.1 MON
	gasLimit := uint64(21000)
	gasPrice, _ := client.SuggestGasPrice(context.Background())

	count, _ := strconv.Atoi(os.Getenv("RELAYER_COUNT"))
	for i := 0; i < count; i++ {
		targetAddr := os.Getenv(fmt.Sprintf("RELAYER_ADDR_%d", i))
		if targetAddr == "" { continue }
		toAddress := common.HexToAddress(targetAddr)

		tx := types.NewTransaction(nonce, toAddress, amount, gasLimit, gasPrice, nil)
		signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), mainPrivateKey)
		if err != nil {
			fmt.Printf("❌ 签名失败: %v\n", err)
			continue
		}

		err = client.SendTransaction(context.Background(), signedTx)
		if err != nil {
			fmt.Printf("❌ 分发至 %s 失败: %v\n", targetAddr, err)
		} else {
			fmt.Printf("✅ 已分发至 %s | Tx: %s\n", targetAddr, signedTx.Hash().Hex())
			nonce++
		}
	}
}