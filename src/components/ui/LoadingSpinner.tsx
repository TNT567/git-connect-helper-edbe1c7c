import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'wallet' | 'scan' | 'chain';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  size = 'md',
  variant = 'default'
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'wallet':
        return {
          border: 'border-orange-500/30 border-t-orange-500',
          text: 'text-orange-400',
          glow: 'shadow-orange-500/20'
        };
      case 'scan':
        return {
          border: 'border-cyan-500/30 border-t-cyan-500',
          text: 'text-cyan-400',
          glow: 'shadow-cyan-500/20'
        };
      case 'chain':
        return {
          border: 'border-purple-500/30 border-t-purple-500',
          text: 'text-purple-400',
          glow: 'shadow-purple-500/20'
        };
      default:
        return {
          border: 'border-blue-500/30 border-t-blue-500',
          text: 'text-blue-400',
          glow: 'shadow-blue-500/20'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${sizeClasses[size]} border-4 ${styles.border} rounded-full animate-spin shadow-lg ${styles.glow}`} />
      <p className={`${styles.text} text-xs uppercase tracking-[0.2em] font-mono animate-pulse`}>
        {message}
      </p>
    </div>
  );
};

// 钱包签名专用 Loading
export const WalletSigningLoader: React.FC<{ status: string }> = ({ status }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-[#131722] border border-orange-500/20 rounded-3xl p-8 max-w-sm w-full mx-4 text-center space-y-6">
        <div className="w-20 h-20 mx-auto relative">
          <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-4 border-yellow-500/20 rounded-full"></div>
          <div className="absolute inset-2 border-4 border-yellow-500 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🦊</span>
          </div>
        </div>
        <div>
          <h3 className="text-white font-bold mb-2">Wallet Interaction</h3>
          <p className="text-orange-400 text-sm animate-pulse">{status}</p>
        </div>
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// 扫码动画 Loading
export const ScanningLoader: React.FC = () => {
  return (
    <div className="relative w-48 h-48 mx-auto">
      {/* 扫描框 */}
      <div className="absolute inset-0 border-2 border-cyan-500/50 rounded-lg">
        {/* 四角装饰 */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>
      </div>
      
      {/* 扫描线动画 */}
      <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan"></div>
      
      {/* 中心图标 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center animate-pulse">
          <span className="text-3xl">📱</span>
        </div>
      </div>
      
      {/* 文字 */}
      <div className="absolute -bottom-8 left-0 right-0 text-center">
        <p className="text-cyan-400 text-xs uppercase tracking-widest animate-pulse">
          Scanning...
        </p>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0; opacity: 1; }
          50% { top: calc(100% - 2px); opacity: 0.5; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
