import React, { useState } from 'react';
import { useBettingSimulation } from '../hooks/useMockSimulation';
import { WalletSigningLoader } from './ui/LoadingSpinner';
import { showToast } from './ui/CyberpunkToast';
import { MockBook } from '../data/mockData';

interface BettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: MockBook;
  onBetPlaced?: (amount: number, newPool: number) => void;
}

export const BettingModal: React.FC<BettingModalProps> = ({
  isOpen,
  onClose,
  book,
  onBetPlaced
}) => {
  const [amount, setAmount] = useState<string>('100');
  const [prediction, setPrediction] = useState<'up' | 'down'>('up');
  const { isProcessing, walletStatus, placeBet, resetBet } = useBettingSimulation();

  const handlePlaceBet = async () => {
    const betAmount = parseFloat(amount) || 0;
    if (betAmount <= 0) {
      showToast('Please enter a valid amount', 'warning');
      return;
    }

    const result = await placeBet(betAmount, book.id);
    
    if (result.success) {
      showToast(
        `Bet placed! ${betAmount} USDT on ${book.symbol}`,
        'success',
        result.txHash
      );
      onBetPlaced?.(betAmount, book.predictionPool + betAmount);
      handleClose();
    }
  };

  const handleClose = () => {
    resetBet();
    setAmount('100');
    onClose();
  };

  if (!isOpen) return null;

  // 钱包签名中显示专用 Loading
  if (isProcessing && walletStatus) {
    return <WalletSigningLoader status={walletStatus} />;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md px-4">
      <div className="max-w-md w-full bg-[#131722] border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* 顶部光效 */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />

        {/* 标题 */}
        <div className="text-center">
          <h2 className="text-lg font-bold text-white mb-1">Place Your Prediction</h2>
          <p className="text-xs text-purple-400 font-mono">{book.symbol}</p>
        </div>

        {/* 书籍信息 */}
        <div className="bg-black/30 rounded-xl p-4 flex items-center gap-4">
          <img 
            src={book.coverImage} 
            alt={book.title}
            className="w-14 h-20 object-cover rounded"
            onError={(e) => {
              e.currentTarget.src = 'https://placehold.co/100x140/1e293b/a855f7?text=Book';
            }}
          />
          <div className="flex-1">
            <p className="text-white font-medium">{book.title}</p>
            <p className="text-xs text-gray-500">{book.author}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">Current Sales:</span>
              <span className="text-sm font-bold text-cyan-400">{book.sales.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 奖金池信息 */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
          <p className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">Current Pool</p>
          <p className="text-2xl font-black text-white">
            {book.predictionPool.toLocaleString()} <span className="text-sm text-gray-400">USDT</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Time Left: {book.predictionTimeLeft}</p>
        </div>

        {/* 预测方向 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPrediction('up')}
            className={`py-4 rounded-xl font-bold text-sm uppercase transition-all ${
              prediction === 'up'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
          >
            📈 Sales Up
          </button>
          <button
            onClick={() => setPrediction('down')}
            className={`py-4 rounded-xl font-bold text-sm uppercase transition-all ${
              prediction === 'down'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
            }`}
          >
            📉 Sales Down
          </button>
        </div>

        {/* 金额输入 */}
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Bet Amount (USDT)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-xl font-bold text-center text-white outline-none focus:border-purple-500 transition-all"
              placeholder="100"
              min="1"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              USDT
            </div>
          </div>
          <div className="flex justify-center gap-2 mt-2">
            {[50, 100, 500, 1000].map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset.toString())}
                className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          <button
            onClick={handlePlaceBet}
            disabled={isProcessing || !amount || parseFloat(amount) <= 0}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm uppercase tracking-widest hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isProcessing ? 'Processing...' : `Confirm Prediction`}
          </button>
          
          <button
            onClick={handleClose}
            className="w-full py-3 text-gray-500 text-xs uppercase tracking-widest hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* 免责声明 */}
        <p className="text-[9px] text-gray-600 text-center">
          This is a demo. No real transactions will occur.
        </p>
      </div>
    </div>
  );
};
