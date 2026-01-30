import React, { useState } from 'react';
import { useScanSimulation } from '../hooks/useMockSimulation';
import { ScanningLoader } from './ui/LoadingSpinner';
import { showToast } from './ui/CyberpunkToast';

interface ScanVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

export const ScanVerifyModal: React.FC<ScanVerifyModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { isScanning, scanResult, startScan, resetScan } = useScanSimulation();
  const [showResult, setShowResult] = useState(false);

  const handleScan = async () => {
    await startScan();
    setShowResult(true);
  };

  const handleClose = () => {
    resetScan();
    setShowResult(false);
    onClose();
  };

  const handleConfirm = () => {
    if (scanResult?.success) {
      showToast('NFT Minted Successfully!', 'success', scanResult.txHash);
      onSuccess?.(scanResult);
    }
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md px-4">
      <div className="max-w-md w-full bg-[#131722] border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* 顶部光效 */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

        {/* 标题 */}
        <div className="text-center">
          <h2 className="text-lg font-bold text-white mb-2">
            {isScanning ? '正在扫描验证...' : showResult ? '验证结果' : '扫描二维码'}
          </h2>
          <p className="text-xs text-gray-500">
            {isScanning ? '模拟链上交互中' : showResult ? '' : '点击下方按钮开始扫描'}
          </p>
        </div>

        {/* 内容区域 */}
        <div className="py-6">
          {isScanning ? (
            <ScanningLoader />
          ) : showResult && scanResult ? (
            <div className="space-y-4">
              {/* 结果图标 */}
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                scanResult.success 
                  ? 'bg-emerald-500/20 border border-emerald-500/30' 
                  : 'bg-red-500/20 border border-red-500/30'
              }`}>
                <span className="text-4xl">
                  {scanResult.success ? '✓' : '⚠️'}
                </span>
              </div>

              {/* 书籍信息 */}
              {scanResult.book && (
                <div className="bg-black/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <img 
                      src={scanResult.book.coverImage} 
                      alt={scanResult.book.title}
                      className="w-12 h-16 object-cover rounded"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/100x140/1e293b/22d3ee?text=Book';
                      }}
                    />
                    <div>
                      <p className="text-white font-medium">{scanResult.book.title}</p>
                      <p className="text-xs text-gray-500">{scanResult.book.author}</p>
                    </div>
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${
                    scanResult.success ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {scanResult.book.verificationStatus}
                  </div>
                </div>
              )}

              {/* 状态消息 */}
              <p className={`text-center text-sm font-medium ${
                scanResult.success ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {scanResult.message}
              </p>

              {/* 交易信息 */}
              {scanResult.success && (
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Transaction Hash</p>
                  <p className="text-xs font-mono text-cyan-400 break-all">
                    {scanResult.txHash}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Token ID: #{scanResult.tokenId}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-4 border border-cyan-500/20">
                <span className="text-5xl">📱</span>
              </div>
              <p className="text-gray-400 text-sm">
                点击按钮模拟扫描书籍二维码
              </p>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          {!showResult ? (
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-sm uppercase tracking-widest hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isScanning ? 'Scanning...' : 'Scan QR Code'}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 ${
                scanResult?.success
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              }`}
            >
              {scanResult?.success ? 'Confirm & Close' : 'Close'}
            </button>
          )}
          
          {!isScanning && (
            <button
              onClick={handleClose}
              className="w-full py-3 text-gray-500 text-xs uppercase tracking-widest hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
