import redis

REDIS_CONF = {'host': '127.0.0.1', 'port': 6379, 'db': 0, 'decode_responses': True}

def get_real_available_codes():
    r = redis.Redis(**REDIS_CONF)
    # 🌟 关键：从后端校验的“有效池”里取码
    valid_hashes = r.smembers("vault:codes:valid")
    
    if not valid_hashes:
        print("❌ 警告：所有读者码都已被消耗（vault:codes:valid 为空）！")
        print("💡 解决：请重新运行 generate_vault_data01-27.py 注入新数据。")
        return

    print(f"✅ 发现 {len(valid_hashes)} 个待使用的有效码：")
    for h in valid_hashes:
        bind_data = r.hgetall(f"vault:bind:{h}")
        print(f"Hash: {h} | Addr: {bind_data.get('address')}")

if __name__ == "__main__":
    get_real_available_codes()
