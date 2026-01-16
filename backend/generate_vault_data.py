import redis
import secrets
from eth_account import Account
import json

# 配置 Redis
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def generate_books(count=10):
    print(f"🚀 开始生成 {count} 组金库数据...")
    
    for i in range(count):
        # 1. 生成唯一码 (类似你 URL 里的长哈希)
        code_hash = secrets.token_hex(32)
        
        # 2. 生成配套的临时钱包 (一书一码一钱包)
        # 这里的钱包是给读者接收 NFT 用的物理地址
        acct = Account.create()
        address = acct.address
        private_key = acct.key.hex()

        # 3. 写入 Redis
        # A. 加入正版库
        r.sadd("vault:codes:valid", code_hash)
        
        # B. 建立物理映射 (Hash 结构)
        # 前端 get-binding 接口会读取这里
        r.hset(f"vault:bind:{code_hash}", mapping={
            "address": address,
            "private_key": private_key
        })

        print(f"ID {i+1} | Code: {code_hash[:10]}... | Addr: {address}")

    print("\n✅ 数据导入完成！")
    print(f"当前有效码总数: {r.scard('vault:codes:valid')}")

if __name__ == "__main__":
    # 启用未经审核的私钥生成警告消除
    Account.enable_unaudited_hdwallet_features()
    generate_books(20) # 默认生成 20 组
