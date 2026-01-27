import redis

# --- 配置区 ---
REDIS_CONF = {
    'host': '127.0.0.1',
    'port': 6379,
    'db': 0,
    'decode_responses': True
}

def fetch_only_valid_reader_codes():
    try:
        r = redis.Redis(**REDIS_CONF)
        r.ping()
    except Exception as e:
        print(f"❌ 无法连接到 Redis: {e}")
        return

    # 1. 🌟 从有效读者集合中获取所有成员
    # 使用 smembers 获取集合内所有还未被 SRem 掉的码
    valid_codes = r.smembers("vault:codes:valid")
    
    if not valid_codes:
        print("📭 Redis 中没有剩余的有效读者码。")
        print("💡 请运行 generate_vault_data01-27.py 重新注入，或检查码是否已被 mintHandler 消耗。")
        return

    print(f"✅ 成功查询到 {len(valid_codes)} 个可用读者码：")
    print("-" * 60)
    print(f"{'Reader Hash (用于前端输入)':<45} | {'Bound Address'}")
    print("-" * 60)

    for code_hash in valid_codes:
        # 2. 联动查询绑定的钱包地址
        target_key = f"vault:bind:{code_hash}"
        bind_data = r.hgetall(target_key)
        address = bind_data.get('address', 'Unknown')
        
        print(f"{code_hash:<45} | {address}")
    
    print("-" * 60)
    print("🚀 提示：复制 Hash 到前端，配合该钱包地址即可测试【金库后台】功能。")

if __name__ == "__main__":
    fetch_only_valid_reader_codes()
