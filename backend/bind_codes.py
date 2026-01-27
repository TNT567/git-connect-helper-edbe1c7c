import redis
from eth_account import Account

# 连接 Redis
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# 你的固定 Hash (或从列表读取)
target_hash = "e5487c51bd6dfcd8b02070a56e704697ffe6f770f16352d930373bc3233817c2"

def bind_wallet_to_code(code_hash):
    # 1. 生成新钱包
    acct = Account.create()
    
    # 2. 映射关系存入 Redis Hash
    # 使用 HSET 存储地址和私钥
    r.hset(f"vault:bind:{code_hash}", mapping={
        "address": acct.address,
        "private_key": acct.key.hex()
    })
    
    # 3. 同时确保该码在有效码池中
    r.sadd("vault:codes:valid", code_hash)
    
    print(f"✅ 绑定成功!")
    print(f"Hash: {code_hash}")
    print(f"Mapped Address: {acct.address}")

if __name__ == "__main__":
    bind_wallet_to_code(target_hash)
