import React, { useState, useEffect } from 'react';
import { mockDelay, MOCK_LEADERBOARD, generateFakeTxHash, getRandomBook } from '../data/mockData';
import { showToast, ToastContainer } from '../components/ui/CyberpunkToast';

// --- 子组件：Leaderboard (社区贡献排行榜 - Mock) ---
const Leaderboard: React.FC = () => {
  const [list, setList] = useState<{ address: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMockLeaderboard = async () => {
      await mockDelay(800);
      setList(MOCK_LEADERBOARD);
      setLoading(false);
    };
    loadMockLeaderboard();
  }, []);

  if (loading) return <div className="text-center text-slate-500 py-6 text-xs animate-pulse">同步 Mock 排行中...</div>;

  return (
    <div className="mt-8 w-full bg-[#0f172a]/50 rounded-2xl border border-white/5 overflow-hidden shadow-inner">
      <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
        <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">🏆 社区贡献榜 (Mock)</h3>
        <span className="text-[10px] text-slate-500">模拟数据</span>
      </div>
      <div className="divide-y divide-white/5">
        {list.map((item, index) => (
          <div key={item.address} className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                index === 0 ? 'bg-yellow-500 text-black' : 
                index === 1 ? 'bg-slate-300 text-black' :
                index === 2 ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {index + 1}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {item.address.slice(0, 6)}...{item.address.slice(-4)}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-blue-400">{item.count} 次</div>
              <div className="text-[9px] text-slate-600 uppercase">Referrals</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 主组件：Reward ---
const Reward: React.FC = () => {
  const [codes, setCodes] = useState<string[]>(['', '', '', '', '']);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', msg: string, txHash?: string } | null>(null);

  // Mock: 处理图片上传并模拟二维码提取
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus({ type: 'info', msg: '正在模拟解析二维码图片...' });

    await mockDelay(1500);

    // 生成一个假的 hash code
    const fakeHashCode = `0x${Math.random().toString(16).slice(2, 34)}`;
    
    // 模拟验证并填充
    await verifyAndAddCode(fakeHashCode);
    
    setLoading(false);
    e.target.value = '';
  };

  // Mock: 校验并自动填充槽位
  const verifyAndAddCode = async (h: string) => {
    await mockDelay(500);
    
    // 模拟验证成功
    const isValid = Math.random() > 0.2; // 80% 成功率
    
    if (isValid) {
      if (codes.includes(h)) {
        setStatus({ type: 'info', msg: '该书码已在列表中' });
        return;
      }

      const emptyIdx = codes.findIndex(c => c === '');
      if (emptyIdx !== -1) {
        const newCodes = [...codes];
        newCodes[emptyIdx] = h;
        setCodes(newCodes);
        
        const book = getRandomBook();
        setStatus({ type: 'success', msg: `正版验证成功！《${book.title}》已自动填入` });
      } else {
        setStatus({ type: 'error', msg: '5 个槽位已满，请先提交领取' });
      }
    } else {
      setStatus({ type: 'error', msg: '无效二维码：可能是盗版或已被使用 (Mock 随机失败)' });
    }
  };

  // Mock: 提交领取奖励
  const handleSubmit = async () => {
    const finalCodes = codes.filter(c => c !== '');
    const cleanAddr = walletAddress.trim().toLowerCase();

    if (finalCodes.length < 5) {
      showToast('请先集齐 5 个书码', 'warning');
      return;
    }

    if (!cleanAddr.startsWith('0x')) {
      showToast('请输入有效的钱包地址', 'warning');
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', msg: '正在模拟发放 MON 奖励...' });

    await mockDelay(2000);

    const txHash = generateFakeTxHash();
    const randomCount = Math.floor(Math.random() * 20) + 1;

    setCodes(['', '', '', '', '']);
    setStatus({ 
      type: 'success', 
      msg: `🎉 领取成功！您已累计推荐 ${randomCount} 位读者。`,
      txHash 
    });

    showToast(`🎉 奖励已发放！累计推荐 ${randomCount} 人`, 'success', txHash);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-4">
      <ToastContainer />
      
      <div className="max-w-md w-full bg-[#1e293b] p-8 rounded-2xl border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold mb-2 text-center text-blue-400">🐳 拍照提取返利</h2>
        
        {/* Demo 标识 */}
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2 text-center mb-6">
          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">🔧 Demo Mode - Mock Data</p>
        </div>
        
        <div className="mb-8">
          <label className="block text-center p-6 border-2 border-dashed border-white/20 rounded-xl hover:border-blue-500 cursor-pointer transition-all bg-[#0f172a]/50">
            <span className="text-sm text-slate-400">{loading ? '模拟处理中...' : '点击上传任意图片模拟扫码'}</span>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={loading}
            />
          </label>
        </div>

        {status && (
          <div className={`mb-4 p-3 rounded-lg text-xs break-all ${
            status.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
            status.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            <div className="font-bold mb-1">{status.msg}</div>
            {status.txHash && (
               <div className="mt-2 text-[10px] opacity-70">
                 Mock TX: <span className="font-mono">{status.txHash.slice(0, 20)}...</span>
               </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="text"
            placeholder="您的收款钱包地址 (0x...)"
            className="w-full bg-[#0f172a] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-2">
            {codes.map((code, index) => (
              <input
                key={index}
                type="text"
                readOnly
                placeholder={`待填充书码 ${index + 1}`}
                className={`w-full bg-[#0f172a]/50 border rounded-lg px-3 py-2 text-[10px] italic ${
                  code ? 'border-green-500/30 text-green-400' : 'border-white/5 text-slate-500'
                }`}
                value={code ? `${code.slice(0, 16)}...` : ''}
              />
            ))}
          </div>
        </div>

        <button 
          onClick={handleSubmit} 
          className="mt-8 w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 py-4 rounded-xl font-bold disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 transition-all shadow-xl active:scale-95"
          disabled={loading || codes.filter(c => c).length < 5 || !walletAddress.startsWith('0x')}
        >
          {loading ? '正在处理数据...' : '集齐 5 码领取 0.001 MON (Mock)'}
        </button>

        <Leaderboard />
      </div>
      
      <p className="mt-6 text-[10px] text-slate-500 font-mono">Whale Vault Protocol • DEMO MODE</p>
    </div>
  );
};

export default Reward;
