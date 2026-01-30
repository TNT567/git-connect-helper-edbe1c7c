import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMintSimulation } from '../hooks/useMockSimulation';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export default function MintConfirm() {
  const { hashCode } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  
  const [error, setError] = useState<string | null>(null);
  const code = hashCode || params.get('code') || '';
  const bookIdRaw = params.get('book_id') ?? '1';
  
  const { isMinting, mintStatus, mintResult, executeMint } = useMintSimulation();
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const performMint = async () => {
      if (!code || hasStarted) return;
      setHasStarted(true);

      // 检查无效码
      if (code.toLowerCase().startsWith('invalid') || code.length < 8) {
        setError('INVALID_CODE');
        return;
      }

      try {
        const result = await executeMint(code);
        
        if (result.success) {
          // 跳转到成功页面
          const query = new URLSearchParams({
            book_id: bookIdRaw,
            address: result.address,
            txHash: result.txHash,
            codeHash: code,
            token_id: result.tokenId.toString()
          });

          navigate(`/success?${query.toString()}`, { replace: true });
        }
      } catch (e) {
        console.error("Mock mint failed:", e);
        setError('MINT_FAILED');
      }
    };

    performMint();
  }, [code, hasStarted, executeMint, navigate, bookIdRaw]);

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full bg-[#131722] border border-white/10 rounded-[32px] p-8 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <span className="text-red-500 text-4xl">✕</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            {error === 'INVALID_CODE' ? '无效的二维码' : '铸造失败'}
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            {error === 'INVALID_CODE' 
              ? '该二维码无效或已被使用。请确认您扫描的是正版商品附带的二维码。'
              : '铸造过程中出现错误，请重试。'}
          </p>
          {error === 'INVALID_CODE' && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-xs text-yellow-500/80 font-medium">
                ⚠️ DEMO 模式：避免使用 'invalid' 开头的码
              </p>
            </div>
          )}
          <button 
            onClick={() => navigate('/bookshelf', { replace: true })}
            className="w-full py-4 rounded-xl bg-white/5 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
          >
            返回大盘
          </button>
        </div>
        <div className="mt-10 text-[9px] text-gray-600 uppercase tracking-[0.4em] font-medium">
          Whale Vault Protocol <span className="mx-2">•</span> DEMO MODE
        </div>
      </div>
    );
  }

  // 加载状态
  return (
    <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center">
      <LoadingSpinner 
        message={mintStatus || '正在验证二维码...'} 
        variant="chain"
        size="lg"
      />
      <div className="mt-8 max-w-xs text-center">
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
            🔧 DEMO MODE
          </p>
          <p className="text-[9px] text-gray-500 mt-1">
            模拟链上 NFT 铸造流程
          </p>
        </div>
      </div>
    </div>
  );
}
