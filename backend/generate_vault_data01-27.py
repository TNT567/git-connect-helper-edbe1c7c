import redis
import secrets
from eth_account import Account
import json

# 配置 Redis
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def generate_vault_entry(role_type):
    """
    生成单组数据：包括一个 HashCode 和一个绑定的钱包
    role_type: 'reader', 'author', 'publisher'
    """
    # 1. 生成唯一码 (视觉无差别的 64 位十六进制字符串)
    code_hash = secrets.token_hex(32)
    
    # 2. 生成配套的临时钱包 (一书一码一钱包)
    # 启用未经审核的私钥生成警告消除
    Account.enable_unaudited_hdwallet_features()
    acct = Account.create()
    address = acct.address
    private_key = acct.key.hex()

    # 3. 建立物理映射 (Hash 结构)，用于后端 get-binding 接口反查地址
    r.hset(f"vault:bind:{code_hash}", mapping={
        "address": address,
        "private_key": private_key
    })

    # 4. 根据角色分类存入不同的 Redis 集合 (用于后端身份校验)
    if role_type == 'reader':
        r.sadd("vault:codes:valid", code_hash)
    elif role_type == 'author':
        r.sadd("vault:roles:authors_codes", code_hash)
    elif role_type == 'publisher':
        r.sadd("vault:roles:publishers_codes", code_hash)

    return code_hash, address

def main():
    print("🚀 开始初始化 Whale Vault 多身份金库数据...")

    # 清理旧数据 (可选，测试时建议开启)
    # r.flushdb() 

    # --- 生成 10 组读者码 ---
    print("\n[读者码生成中...]")
    for _ in range(10):
        c, a = generate_vault_entry('reader')
        print(f"Reader | Code: {c[:12]}... | Addr: {a}")

    # --- 生成 2 组作者码 ---
    print("\n[作者码生成中...]")
    for _ in range(2):
        c, a = generate_vault_entry('author')
        print(f"Author | Code: {c[:12]}... | Addr: {a}")

    # --- 生成 1 组出版社码 ---
    print("\n[出版社码生成中...]")
    c, a = generate_vault_entry('publisher')
    print(f"Pub    | Code: {c[:12]}... | Addr: {a}")
    
    # 特别注意：出版社码需要配合出版社钱包地址白名单使用
    # 请将你测试用的钱包地址手动加入白名单 (例如 MetaMask 地址)
    my_test_wallet = "0x你的钱包地址".lower()
    r.sadd("vault:roles:publishers", my_test_wallet)

    print("\n✅ 所有身份码初始化完成！")
    print(f"读者池: {r.scard('vault:codes:valid')} | 作者池: {r.scard('vault:roles:authors_codes')} | 出版社池: {r.scard('vault:roles:publishers_codes')}")

if __name__ == "__main__":
    main()
