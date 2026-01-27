package blockchain

import (
	"context"
	"fmt"
	"math/big"
	"sort"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// DispenseReward 确保将奖励精确发送给 recipientAddr
func DispenseReward(client *ethclient.Client, recipientAddr string, privateKeyHex string, contractAddrHex string, bookCodes []string) (string, string, error) {
	// 1. 解析私钥并获取后端发送者地址
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return "", "", fmt.Errorf("私钥无效: %v", err)
	}
	fromAddr := crypto.PubkeyToAddress(privateKey.PublicKey)

	// 2. 准备合约与接收者地址
	contractAddr := common.HexToAddress(contractAddrHex)
	recipient := common.HexToAddress(recipientAddr)

	// 3. 构造函数签名: dispenseTokens(address,bytes32)
	// 确保合约中此函数有 'onlyBackend' 或类似的修饰器，校验的是 msg.sender
	methodID := crypto.Keccak256([]byte("dispenseTokens(address,bytes32)"))[:4]

	// 参数编码：必须严格按照 ABI 规范
	paddedAddr := common.LeftPadBytes(recipient.Bytes(), 32)
	hashCode := generateBusinessHashCode(bookCodes) // 内部排序确保唯一性

	var data []byte
	data = append(data, methodID...)
	data = append(data, paddedAddr...)
	data = append(data, hashCode[:]...)

	// 4. 获取链上实时参数
	nonce, err := client.PendingNonceAt(context.Background(), fromAddr)
	if err != nil {
		return "", "", fmt.Errorf("获取 nonce 失败: %v", err)
	}

	gasPrice, err := client.SuggestGasPrice(context.Background())
	if err != nil {
		return "", "", fmt.Errorf("获取 gasPrice 失败: %v", err)
	}

	chainID, err := client.ChainID(context.Background())
	if err != nil {
		return "", "", fmt.Errorf("获取 chainID 失败: %v", err)
	}

	// 5. 构造交易：注意 GasLimit
	// 如果合约内逻辑复杂（涉及白名单查询和转账），建议给 150,000 以上
	tx := types.NewTx(&types.LegacyTx{
		Nonce:    nonce,
		To:       &contractAddr,
		Value:    big.NewInt(0), 
		Gas:      150000, 
		GasPrice: gasPrice,
		Data:     data,
	})

	// 6. 签名并发送
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		return "", "", fmt.Errorf("签名失败: %v", err)
	}

	err = client.SendTransaction(context.Background(), signedTx)
	if err != nil {
		return "", "", fmt.Errorf("发送失败: %v", err)
	}

	return signedTx.Hash().Hex(), fmt.Sprintf("0x%x", hashCode), nil
}

// 内部逻辑：确保 5 个码顺序无关
func generateBusinessHashCode(codes []string) [32]byte {
	sorted := make([]string, len(codes))
	copy(sorted, codes)
	sort.Strings(sorted)
	var combined []byte
	for _, c := range sorted {
		combined = append(combined, []byte(c)...)
	}
	return crypto.Keccak256Hash(combined)
}
