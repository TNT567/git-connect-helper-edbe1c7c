import { useState, useCallback } from 'react';
import { 
  mockDelay, 
  mockScanVerification, 
  mockWalletSignature,
  generateFakeTxHash,
  generateFakeTokenId,
  getRandomBook,
  MockBook 
} from '../data/mockData';

// ========== 扫码模拟 Hook ==========
export const useScanSimulation = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    book: MockBook | null;
    txHash: string;
    tokenId: number;
    message: string;
  } | null>(null);

  const startScan = useCallback(async () => {
    setIsScanning(true);
    setScanResult(null);

    try {
      const result = await mockScanVerification();
      
      setScanResult({
        success: result.success,
        book: result.book,
        txHash: result.txHash,
        tokenId: result.tokenId,
        message: result.success 
          ? '✅ NFT Minted / Product Verified' 
          : '⚠️ 警告：检测到盗版书籍'
      });
    } catch (error) {
      setScanResult({
        success: false,
        book: null,
        txHash: '',
        tokenId: 0,
        message: '扫码失败，请重试'
      });
    } finally {
      setIsScanning(false);
    }
  }, []);

  const resetScan = useCallback(() => {
    setScanResult(null);
  }, []);

  return { isScanning, scanResult, startScan, resetScan };
};

// ========== 下注/预测模拟 Hook ==========
export const useBettingSimulation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletStatus, setWalletStatus] = useState<string>('');
  const [betResult, setBetResult] = useState<{
    success: boolean;
    txHash: string;
    message: string;
  } | null>(null);

  const placeBet = useCallback(async (amount: number, bookId: string) => {
    setIsProcessing(true);
    setBetResult(null);
    
    // 阶段 1: 等待钱包签名
    setWalletStatus('Waiting for Metamask...');
    await mockDelay(1000);
    
    // 阶段 2: 签名确认
    setWalletStatus('Confirming signature...');
    await mockDelay(800);
    
    // 阶段 3: 发送交易
    setWalletStatus('Broadcasting transaction...');
    const result = await mockWalletSignature();
    
    setBetResult({
      success: result.success,
      txHash: result.txHash,
      message: `🎉 Transaction Success! Bet ${amount} USDT placed.`
    });
    
    setWalletStatus('');
    setIsProcessing(false);
    
    return result;
  }, []);

  const resetBet = useCallback(() => {
    setBetResult(null);
    setWalletStatus('');
  }, []);

  return { isProcessing, walletStatus, betResult, placeBet, resetBet };
};

// ========== NFT Mint 模拟 Hook ==========
export const useMintSimulation = () => {
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState<string>('');
  const [mintResult, setMintResult] = useState<{
    success: boolean;
    txHash: string;
    tokenId: number;
    address: string;
  } | null>(null);

  const executeMint = useCallback(async (codeHash: string) => {
    setIsMinting(true);
    setMintResult(null);

    // 阶段 1: 验证码哈希
    setMintStatus('正在验证二维码...');
    await mockDelay(800);

    // 阶段 2: 获取绑定地址
    setMintStatus('获取绑定地址...');
    await mockDelay(600);

    // 阶段 3: 发起 Mint
    setMintStatus('正在链上铸造 NFT...');
    await mockDelay(1200);

    // 生成结果
    const fakeAddress = `0x${codeHash.slice(0, 40)}`;
    
    setMintResult({
      success: true,
      txHash: generateFakeTxHash(),
      tokenId: generateFakeTokenId(),
      address: fakeAddress
    });

    setMintStatus('');
    setIsMinting(false);

    return {
      success: true,
      txHash: generateFakeTxHash(),
      tokenId: generateFakeTokenId(),
      address: fakeAddress
    };
  }, []);

  return { isMinting, mintStatus, mintResult, executeMint };
};
