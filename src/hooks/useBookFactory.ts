import { useCallback, useState } from 'react'
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  custom,
  parseEther,
  formatEther,
  type Address 
} from 'viem'
import { confluxESpaceTestnet } from 'viem/chains'
import { FACTORY_ADDRESS, FACTORY_ABI, RPC_URL, EXPLORER_URL } from '@/config/chain'

// 自定义 Conflux eSpace Testnet 链配置
const confluxTestnet = {
  ...confluxESpaceTestnet,
  id: 71,
  name: 'Conflux eSpace Testnet',
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] }
  }
}

// 公共客户端（只读操作）
const publicClient = createPublicClient({
  chain: confluxTestnet,
  transport: http(RPC_URL)
})

export type BookInfo = {
  address: Address
  name: string
  symbol: string
  author: string
  publisher: Address
  deployedAt: Date
  sales: bigint
}

export function useBookFactory() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取部署费用
  const getDeployFee = useCallback(async (): Promise<string> => {
    const fee = await publicClient.readContract({
      address: FACTORY_ADDRESS as Address,
      abi: FACTORY_ABI,
      functionName: 'deployFee'
    }) as bigint
    return formatEther(fee)
  }, [])

  // 获取总书籍数量
  const getTotalBooks = useCallback(async (): Promise<number> => {
    const total = await publicClient.readContract({
      address: FACTORY_ADDRESS as Address,
      abi: FACTORY_ABI,
      functionName: 'totalBooks'
    }) as bigint
    return Number(total)
  }, [])

  // 获取出版社的书籍列表
  const getPublisherBooks = useCallback(async (publisher: Address): Promise<Address[]> => {
    const books = await publicClient.readContract({
      address: FACTORY_ADDRESS as Address,
      abi: FACTORY_ABI,
      functionName: 'getPublisherBooks',
      args: [publisher]
    }) as Address[]
    return books
  }, [])

  // 获取书籍详情
  const getBookInfo = useCallback(async (bookAddress: Address): Promise<BookInfo> => {
    const [info, sales] = await Promise.all([
      publicClient.readContract({
        address: FACTORY_ADDRESS as Address,
        abi: FACTORY_ABI,
        functionName: 'bookInfo',
        args: [bookAddress]
      }),
      publicClient.readContract({
        address: FACTORY_ADDRESS as Address,
        abi: FACTORY_ABI,
        functionName: 'getBookSales',
        args: [bookAddress]
      })
    ])

    const [name, symbol, author, publisher, deployedAt] = info as [string, string, string, Address, bigint]
    
    return {
      address: bookAddress,
      name,
      symbol,
      author,
      publisher,
      deployedAt: new Date(Number(deployedAt) * 1000),
      sales: sales as bigint
    }
  }, [])

  // 部署新书 (需要连接钱包)
  const deployBook = useCallback(async (params: {
    bookName: string
    symbol: string
    authorName: string
    baseURI: string
    relayer?: Address
  }): Promise<{ txHash: string; bookAddress: Address }> => {
    setIsLoading(true)
    setError(null)

    try {
      // 检查是否有 MetaMask
      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包')
      }

      // 请求连接钱包
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[]
      
      if (!accounts || accounts.length === 0) {
        throw new Error('请连接钱包')
      }

      // 检查并切换网络
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
      if (parseInt(chainId, 16) !== 71) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x47' }] // 71 的十六进制
          })
        } catch (switchError: any) {
          // 如果网络不存在，添加网络
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x47',
                chainName: 'Conflux eSpace Testnet',
                rpcUrls: [RPC_URL],
                nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
                blockExplorerUrls: [EXPLORER_URL]
              }]
            })
          } else {
            throw switchError
          }
        }
      }

      // 创建钱包客户端
      const walletClient = createWalletClient({
        chain: confluxTestnet,
        transport: custom(window.ethereum)
      })

      // 获取部署费用
      const deployFee = await publicClient.readContract({
        address: FACTORY_ADDRESS as Address,
        abi: FACTORY_ABI,
        functionName: 'deployFee'
      }) as bigint

      // 发送部署交易
      const hash = await walletClient.writeContract({
        account: accounts[0] as Address,
        address: FACTORY_ADDRESS as Address,
        abi: FACTORY_ABI,
        functionName: 'deployBook',
        args: [
          params.bookName,
          params.symbol,
          params.authorName,
          params.baseURI,
          params.relayer || '0x0000000000000000000000000000000000000000'
        ],
        value: deployFee
      })

      // 等待交易确认
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      // 从事件日志中获取新书合约地址
      const bookDeployedLog = receipt.logs.find(log => {
        try {
          return log.topics[0] === '0x...' // BookDeployed 事件签名
        } catch {
          return false
        }
      })

      // 简单处理：返回交易哈希，让用户去浏览器查看
      return {
        txHash: hash,
        bookAddress: '0x' as Address // 实际地址需要从事件解析
      }
    } catch (err: any) {
      const message = err.message || '部署失败'
      setError(message)
      throw new Error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 获取交易浏览器链接
  const getExplorerLink = useCallback((txHashOrAddress: string, type: 'tx' | 'address' = 'tx') => {
    return `${EXPLORER_URL}/${type}/${txHashOrAddress}`
  }, [])

  return {
    isLoading,
    error,
    getDeployFee,
    getTotalBooks,
    getPublisherBooks,
    getBookInfo,
    deployBook,
    getExplorerLink
  }
}

// 类型声明扩展
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on?: (event: string, handler: (...args: any[]) => void) => void
    }
  }
}
