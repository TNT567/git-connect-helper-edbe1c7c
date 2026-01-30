// ============================================
// WHALE VAULT - PURE FRONTEND DEMO MODE
// Mock Data Layer (No Backend Required)
// ============================================

export interface MockBook {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  currentPrice: number;
  symbol: string;
  verificationStatus: 'Verified Genuine' | 'Fake' | 'Pending';
  predictionPool: number;
  predictionTimeLeft: string;
  sales: number;
  change: string;
  description: string;
}

export interface MockRegion {
  name: string;
  value: [number, number, number]; // [lng, lat, count]
}

// ========== 核心 Mock 书籍数据 ==========
export const MOCK_BOOKS: MockBook[] = [
  {
    id: 'three-body',
    title: '三体',
    author: '刘慈欣',
    coverImage: 'https://placehold.co/300x450/0f172a/22d3ee?text=三体',
    currentPrice: 89000,
    symbol: '3BODY',
    verificationStatus: 'Verified Genuine',
    predictionPool: 125000,
    predictionTimeLeft: '09D 23H 45M',
    sales: 89000,
    change: '+15.8%',
    description: '刘慈欣科幻巨著，雨果奖获奖作品。预言机数据显示全球销量持续攀升。'
  },
  {
    id: 'fold',
    title: 'The Fold',
    author: 'Peter Clines',
    coverImage: 'https://placehold.co/300x450/1e293b/fbbf24?text=The+Fold',
    currentPrice: 42000,
    symbol: 'FOLD',
    verificationStatus: 'Verified Genuine',
    predictionPool: 78000,
    predictionTimeLeft: '07D 12H 30M',
    sales: 42000,
    change: '+8.2%',
    description: '科幻惊悚小说，探索量子折叠与平行宇宙的边界。'
  },
  {
    id: '1984',
    title: '1984',
    author: 'George Orwell',
    coverImage: 'https://placehold.co/300x450/7c3aed/ffffff?text=1984',
    currentPrice: 156000,
    symbol: 'ORWELL',
    verificationStatus: 'Verified Genuine',
    predictionPool: 230000,
    predictionTimeLeft: '05D 08H 15M',
    sales: 156000,
    change: '+3.4%',
    description: '反乌托邦经典之作，对极权主义的深刻警示。'
  },
  {
    id: 'bitcoin-wp',
    title: 'Bitcoin Whitepaper',
    author: 'Satoshi Nakamoto',
    coverImage: 'https://placehold.co/300x450/f7931a/ffffff?text=BTC',
    currentPrice: 210000,
    symbol: 'BTC-WP',
    verificationStatus: 'Verified Genuine',
    predictionPool: 500000,
    predictionTimeLeft: '03D 16H 42M',
    sales: 210000,
    change: '+0.1%',
    description: '去中心化货币开山之作，开启区块链新纪元。'
  },
  {
    id: 'ethereum-yp',
    title: 'Ethereum Yellowpaper',
    author: 'Vitalik Buterin',
    coverImage: 'https://placehold.co/300x450/627eea/ffffff?text=ETH',
    currentPrice: 155000,
    symbol: 'ETH-YP',
    verificationStatus: 'Verified Genuine',
    predictionPool: 320000,
    predictionTimeLeft: '06D 04H 20M',
    sales: 155000,
    change: '+5.4%',
    description: '智能合约底层协议规范，Web3基础设施。'
  },
  {
    id: 'ghost-wires',
    title: 'The Ghost in the Wires',
    author: 'Kevin Mitnick',
    coverImage: 'https://placehold.co/300x450/ef4444/ffffff?text=GHOST',
    currentPrice: 30700,
    symbol: 'GHOST',
    verificationStatus: 'Fake', // 演示用：一本假书
    predictionPool: 45000,
    predictionTimeLeft: '08D 19H 55M',
    sales: 30700,
    change: '+12.5%',
    description: '⚠️ 警告：此版本可能为盗版。高级攻防实战记录。'
  },
  {
    id: 'sovereign',
    title: 'The Sovereign Individual',
    author: 'J.D. Davidson',
    coverImage: 'https://placehold.co/300x450/22c55e/ffffff?text=SOV',
    currentPrice: 54000,
    symbol: 'SOV-I',
    verificationStatus: 'Verified Genuine',
    predictionPool: 95000,
    predictionTimeLeft: '04D 11H 33M',
    sales: 54000,
    change: '+9.7%',
    description: '预言数字时代个人主权崛起的先知之作。'
  },
  {
    id: 'black-swan',
    title: 'The Black Swan',
    author: 'Nassim Taleb',
    coverImage: 'https://placehold.co/300x450/0ea5e9/ffffff?text=SWAN',
    currentPrice: 68000,
    symbol: 'BLACK',
    verificationStatus: 'Verified Genuine',
    predictionPool: 110000,
    predictionTimeLeft: '02D 07H 18M',
    sales: 68000,
    change: '+4.2%',
    description: '黑天鹅事件理论，揭示不确定性的力量。'
  }
];

// ========== Mock 地理分布数据 ==========
export const MOCK_REGIONS: MockRegion[] = [
  { name: '北京', value: [116.4, 39.9, 45] },
  { name: '上海', value: [121.4, 31.2, 38] },
  { name: '深圳', value: [114.05, 22.54, 32] },
  { name: '杭州', value: [120.15, 30.28, 28] },
  { name: '广州', value: [113.26, 23.13, 25] },
  { name: 'San Francisco', value: [-122.4, 37.77, 42] },
  { name: 'New York', value: [-74.0, 40.71, 35] },
  { name: 'London', value: [-0.12, 51.5, 30] },
  { name: 'Tokyo', value: [139.69, 35.69, 28] },
  { name: 'Singapore', value: [103.85, 1.29, 22] },
  { name: 'Dubai', value: [55.27, 25.2, 18] },
  { name: 'Sydney', value: [151.2, -33.87, 15] },
  { name: 'Seoul', value: [126.97, 37.56, 20] },
  { name: 'Berlin', value: [13.4, 52.52, 16] },
  { name: 'Paris', value: [2.35, 48.85, 14] },
];

// ========== Mock 排行榜数据 ==========
export const MOCK_LEADERBOARD = [
  { address: '0x1234567890abcdef1234567890abcdef12345678', count: 47 },
  { address: '0xabcdef1234567890abcdef1234567890abcdef12', count: 35 },
  { address: '0x9876543210fedcba9876543210fedcba98765432', count: 28 },
  { address: '0xdeadbeef1234567890deadbeef1234567890dead', count: 22 },
  { address: '0xcafebabe9876543210cafebabe9876543210cafe', count: 19 },
  { address: '0x1111222233334444555566667777888899990000', count: 15 },
  { address: '0xaaabbbcccdddeeefffaaabbbcccdddeeefffaaab', count: 12 },
  { address: '0x0000111122223333444455556666777788889999', count: 8 },
];

// ========== 工具函数 ==========

// 生成假交易哈希
export const generateFakeTxHash = (): string => {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
};

// 生成假 Token ID
export const generateFakeTokenId = (): number => {
  return Math.floor(Math.random() * 100000) + 1;
};

// 随机获取一本书
export const getRandomBook = (): MockBook => {
  return MOCK_BOOKS[Math.floor(Math.random() * MOCK_BOOKS.length)];
};

// 根据 ID 获取书籍
export const getBookById = (id: string): MockBook | undefined => {
  return MOCK_BOOKS.find(book => book.id === id);
};

// 模拟延迟
export const mockDelay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 模拟扫码验证结果
export const mockScanVerification = async (): Promise<{
  success: boolean;
  book: MockBook;
  txHash: string;
  tokenId: number;
}> => {
  await mockDelay(1500); // 1.5秒模拟链上交互
  const book = getRandomBook();
  return {
    success: book.verificationStatus !== 'Fake',
    book,
    txHash: generateFakeTxHash(),
    tokenId: generateFakeTokenId()
  };
};

// 模拟钱包签名
export const mockWalletSignature = async (): Promise<{
  success: boolean;
  txHash: string;
}> => {
  await mockDelay(2000); // 2秒模拟 Metamask 签名
  return {
    success: true,
    txHash: generateFakeTxHash()
  };
};

// 计算总销量
export const getTotalSales = (): number => {
  return MOCK_BOOKS.reduce((sum, book) => sum + book.sales, 0);
};

// 计算总预测池
export const getTotalPredictionPool = (): number => {
  return MOCK_BOOKS.reduce((sum, book) => sum + book.predictionPool, 0);
};
