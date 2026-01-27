package main

import (
    "context"
    "crypto/rand"
    "fmt"
    "log"
    "math/big"
    "os"

    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/core/types"
    "github.com/ethereum/go-ethereum/crypto"
    "github.com/ethereum/go-ethereum/ethclient"
)

const (
    RPC_URL          = "https://testnet-rpc2.monad.xyz"
    CONTRACT_ADDRESS = "0xaFEffbA23777283f105c0C652B9fea2A40557727"
)

func main() {
    // 从环境变量读取后端私钥
    privateKeyHex := os.Getenv("BACKEND_PRIVATE_KEY")
    if privateKeyHex == "" {
        log.Fatal("请设置 BACKEND_PRIVATE_KEY 环境变量")
    }

    // 接收地址（示例）
    recipientAddr := "0x1234567890123456789012345678901234567890"

    err := DispenseTokens(privateKeyHex, recipientAddr)
    if err != nil {
        log.Fatal(err)
    }
}

// DispenseTokens 向指定地址转账 0.001 MON
func DispenseTokens(privateKeyHex string, recipientAddr string) error {
    // 1. 连接 RPC
    client, err := ethclient.Dial(RPC_URL)
    if err != nil {
        return fmt.Errorf("连接 RPC 失败: %v", err)
    }
    defer client.Close()

    // 2. 加载私钥
    privateKey, err := crypto.HexToECDSA(privateKeyHex)
    if err != nil {
        return fmt.Errorf("私钥格式错误: %v", err)
    }

    // 3. 获取链信息
    chainID, err := client.ChainID(context.Background())
    if err != nil {
        return fmt.Errorf("获取 chainID 失败: %v", err)
    }

    // 4. 构造调用数据
    contractAddr := common.HexToAddress(CONTRACT_ADDRESS)
    recipient := common.HexToAddress(recipientAddr)

    // 函数选择器: dispenseTokens(address,bytes32)
    methodID := crypto.Keccak256([]byte("dispenseTokens(address,bytes32)"))[:4]

    // 参数1: 地址（补齐32字节）
    paddedAddr := common.LeftPadBytes(recipient.Bytes(), 32)

    // 参数2: 随机生成 hashCode
    var hashCode [32]byte
    rand.Read(hashCode[:])

    // 拼接 data
    var data []byte
    data = append(data, methodID...)
    data = append(data, paddedAddr...)
    data = append(data, hashCode[:]...)

    // 5. 构造交易
    fromAddr := crypto.PubkeyToAddress(privateKey.PublicKey)
    nonce, err := client.PendingNonceAt(context.Background(), fromAddr)
    if err != nil {
        return fmt.Errorf("获取 nonce 失败: %v", err)
    }

    gasPrice, err := client.SuggestGasPrice(context.Background())
    if err != nil {
        return fmt.Errorf("获取 gasPrice 失败: %v", err)
    }

    tx := types.NewTx(&types.LegacyTx{
        Nonce:    nonce,
        To:       &contractAddr,
        Value:    big.NewInt(0),
        Gas:      100000,
        GasPrice: gasPrice,
        Data:     data,
    })

    // 6. 签名并发送
    signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
    if err != nil {
        return fmt.Errorf("签名失败: %v", err)
    }

    err = client.SendTransaction(context.Background(), signedTx)
    if err != nil {
        return fmt.Errorf("发送交易失败: %v", err)
    }

    fmt.Printf("交易已发送: %s\n", signedTx.Hash().Hex())
    fmt.Printf("HashCode: 0x%x\n", hashCode)

    return nil
}
