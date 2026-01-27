import requests
import redis
import time

# --- 配置区 ---
REDIS_CONF = {'host': '127.0.0.1', 'port': 6379, 'db': 0, 'decode_responses': True}
BACKEND_URL = "http://127.0.0.1:8080"

def auto_test_valid_code():
    r = redis.Redis(**REDIS_CONF)
    
    # 1. 🌟 核心改进：从有效池随机抓取一个码，而不是抓取已经失效的 Key
    print("🔍 正在从【有效读者池】提取可用码...")
    valid_hashes = r.smembers("vault:codes:valid")
    
    if not valid_hashes:
        print("❌ 错误：池子空了！请运行 generate_vault_data01-27.py")
        return

    # 取集合中的第一个有效码
    code_hash = list(valid_hashes)[0]
    
    # 2. 反查绑定地址
    bind_data = r.hgetall(f"vault:bind:{code_hash}")
    dest_address = bind_data.get('address')
    
    print(f"✅ 捕获有效目标: \n   Hash: {code_hash}\n   Addr: {dest_address}")

    # --- 开始三步走测试 ---

    # [步骤 1] 获取绑定
    print("\n📡 [步骤 1] 模拟 /secret/get-binding...")
    resp = requests.get(f"{BACKEND_URL}/secret/get-binding", params={"codeHash": code_hash})
    print(f"   响应: {resp.json()}")

    # [步骤 2] 提交铸造 (代付 Gas) [cite: 2026-01-13]
    print("\n⚡ [步骤 2] 模拟代付 Gas 铸造...")
    start = time.time()
    resp_mint = requests.post(f"{BACKEND_URL}/relay/mint", json={
        "dest": dest_address,
        "codeHash": code_hash
    })
    if resp_mint.status_code == 200:
        print(f"   ✅ 成功！TXID: {resp_mint.json().get('txHash')} | 耗时: {round(time.time()-start, 2)}s")
    else:
        print(f"   ❌ 失败: {resp_mint.text}")

    # [步骤 3] 身份核验
    print("\n🛡️ [步骤 3] 模拟身份核验...")
    resp_v = requests.get(f"{BACKEND_URL}/secret/verify", params={
        "codeHash": code_hash,
        "address": dest_address
    })
    print(f"   最终状态: {resp_v.json()}")

if __name__ == "__main__":
    auto_test_valid_code()
