import redis
import random

def generate_random_ip():
    """生成随机的公网 IP 格式"""
    # 避开保留地址段，随机生成一些看起来像真实用户的 IP
    return ".".join(map(str, (random.randint(1, 254) for _ in range(4))))

def main():
    # 连接到本地 Redis
    try:
        r = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)
        
        # 你的 key 名称
        key_name = "vault:reader_ips"
        
        print(f"正在向 {key_name} 写入测试数据...")
        
        # 准备 100 条 IP 数据
        test_ips = [generate_random_ip() for _ in range(100)]
        
        # 使用 SADD 写入集合
        # 因为是集合 (Set)，重复的 IP 会被自动过滤
        added_count = r.sadd(key_name, *test_ips)
        
        print(f"成功写入 {added_count} 条新 IP。")
        print(f"当前集合内 IP 总数: {r.scard(key_name)}")
        
    except Exception as e:
        print(f"连接 Redis 失败: {e}")

if __name__ == "__main__":
    main()
