package blockchain

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto" // 必须导入 crypto 来处理地址生成
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/redis/go-redis/v9"
)

// BookFactory 结构体
type BookFactory struct {
	RDB    *redis.Client
	Client *ethclient.Client
}

// CheckBalanceAndDeploy 执行链上余额检查与大盘索引写入 [cite: 2026-01-13]
func (f *BookFactory) CheckBalanceAndDeploy(ctx context.Context, pubAddr string, bookName string, symbol string) (string, error) {
	// 1. 规范化出版社地址
	address := common.HexToAddress(strings.ToLower(pubAddr))

	// 2. 调用以太坊客户端检查 Native Token (CFX) 余额
	balance, err := f.Client.BalanceAt(ctx, address, nil)
	if err != nil {
		return "", fmt.Errorf("链上通信失败: %v", err)
	}

	// 3. 设定 10 CFX 的理智门槛 (10 * 10^18 Wei)
	threshold := new(big.Int).Mul(big.NewInt(10), big.NewInt(1e18))

	// 4. 余额不足拦截逻辑
	if balance.Cmp(threshold) < 0 {
		actualBalance := new(big.Float).Quo(new(big.Float).SetInt(balance), big.NewFloat(1e18))
		return "", fmt.Errorf("余额不足 (当前: %.2f CFX)。请先向钱包 %s 充值，上架书籍需至少持有 10 CFX 服务预留金", actualBalance, pubAddr)
	}

	// 5. 模拟生成唯一的合约地址
	// 使用 Keccak256 对“出版社地址+书名”进行哈希，确保确定性
	dataToHash := append(address.Bytes(), []byte(bookName)...)
	mockHash := crypto.Keccak256(dataToHash)
	newContractAddr := common.BytesToAddress(mockHash[12:]).Hex() // 截取后20字节作为地址

	// 6. 写入 Redis 同步至“终焉大盘”
	// 格式：Symbol:BookName
	bookInfo := fmt.Sprintf("%s:%s", symbol, bookName)
	
	// 写入书籍详情 Hash
	err = f.RDB.HSet(ctx, "vault:books:registry", newContractAddr, bookInfo).Err()
	if err != nil {
		return "", fmt.Errorf("Redis 详情写入失败: %v", err)
	}

	// 初始化销量大盘 ZSet，分数为 0
	err = f.RDB.ZAdd(ctx, "vault:tickers:sales", redis.Z{
		Score:  0,
		Member: newContractAddr,
	}).Err()
	if err != nil {
		return "", fmt.Errorf("大盘排名初始化失败: %v", err)
	}

	fmt.Printf("✅ [理智验证] 出版社 %s 余额充足，书籍 %s(%s) 已录入大盘\n", pubAddr, bookName, symbol)
	return newContractAddr, nil
}