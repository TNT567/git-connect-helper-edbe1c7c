import asyncio
from web3 import AsyncWeb3
from web3.providers import AsyncHTTPProvider
from eth_account import Account

# --- 配置区 ---
RPC_URL = "https://testnet-rpc.monad.xyz"
CONTRACT_ADDRESS = "0x4148f6CFaB628Aab5E886e93ed76F186Cb5d978C"
PRIVATE_KEY = "202d898368867c5787cdaf331cefee6025c19699ebab5498f6c55bf06a311b83"
MINT_QUANTITY = 10  # 每次 mint 10 个 (ERC721A 非常节省 Gas)
TOTAL_TRANSACTIONS = 100 # 总共发送多少次交易 (总计 1000 NFT)
CONCURRENT_TASKS = 20    # 并发任务数，根据 Monad 的响应速度调大

# 简化的 ABI，只需 mint 函数
ABI = [{"inputs":[{"internalType":"uint256","name":"quantity","description":"","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}]


async def send_mint_tx(w3, account, nonce):
    contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI)
    try:
        # 获取动态 Gas 价格
        base_fee = await w3.eth.gas_price
        priority_fee = w3.to_wei(50, 'gwei')

        # 确保这整个 tx 字典的缩进是整齐的
        tx = await contract.functions.mint(MINT_QUANTITY).build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': 150000,
            'maxFeePerGas': base_fee + priority_fee,
            'maxPriorityFeePerGas': priority_fee,
            'chainId': 10143
        })
        
        signed_tx = Account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = await w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(f"Nonce {nonce} | 交易已发送: {tx_hash.hex()}")
    except Exception as e:
        print(f"Nonce {nonce} | 错误: {e}")

'''
async def send_mint_tx(w3, account, nonce):
    contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI)
    try:
       
        tx = await contract.functions.mint(MINT_QUANTITY).build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': 200000,
            'maxFeePerGas': w3.to_wei(50, 'gwei'),
            'maxPriorityFeePerGas': w3.to_wei(10, 'gwei'),
            'chainId': 10143 # Monad Testnet ChainID
        })
       
        tx = await contract.functions.mint(MINT_QUANTITY).build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': 150000, # 稍微调低一点 gas limit，ERC721A 不需要 20w
            # 提高以下两个值，确保通过网络校验
            'maxFeePerGas': w3.to_wei(100, 'gwei'),        # 从 50 调到 100
            'maxPriorityFeePerGas': w3.to_wei(50, 'gwei'), # 从 10 调到 50
            'chainId': 10143
        })
        signed_tx = Account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = await w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(f"Nonce {nonce} | 交易已发送: {tx_hash.hex()}")
    except Exception as e:
        print(f"Nonce {nonce} | 错误: {e}")
'''

async def main():
    w3 = AsyncWeb3(AsyncHTTPProvider(RPC_URL))
    account = Account.from_key(PRIVATE_KEY)
    start_nonce = await w3.eth.get_transaction_count(account.address)
    
    tasks = []
    for i in range(TOTAL_TRANSACTIONS):
        # 批量创建协程任务
        tasks.append(send_mint_tx(w3, account, start_nonce + i))
        
        # 每达到并发限制，执行一次
        if len(tasks) >= CONCURRENT_TASKS:
            await asyncio.gather(*tasks)
            tasks = []
    
    if tasks:
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
