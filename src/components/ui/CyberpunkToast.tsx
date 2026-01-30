import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  txHash?: string;
  duration?: number;
  onClose: () => void;
}

export const CyberpunkToast: React.FC<ToastProps> = ({
  message,
  type,
  txHash,
  duration = 5000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/50 text-emerald-400';
      case 'error':
        return 'from-red-500/20 to-orange-500/20 border-red-500/50 text-red-400';
      case 'warning':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/50 text-yellow-400';
      default:
        return 'from-blue-500/20 to-purple-500/20 border-blue-500/50 text-blue-400';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  return (
    <div
      className={`fixed top-6 right-6 z-[9999] max-w-md transform transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`bg-gradient-to-r ${getStyles()} border backdrop-blur-xl rounded-2xl p-4 shadow-2xl`}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-lg font-bold">
            {getIcon()}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-white">{message}</p>
            {txHash && (
              <p className="mt-2 text-[10px] font-mono opacity-60 break-all">
                TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="text-white/40 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

// Toast 管理器
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  txHash?: string;
}

let toastId = 0;
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let currentToasts: Toast[] = [];

const notifyListeners = () => {
  toastListeners.forEach(listener => listener([...currentToasts]));
};

export const showToast = (
  message: string,
  type: Toast['type'] = 'info',
  txHash?: string
) => {
  const id = `toast-${++toastId}`;
  currentToasts.push({ id, message, type, txHash });
  notifyListeners();
  return id;
};

export const removeToast = (id: string) => {
  currentToasts = currentToasts.filter(t => t.id !== id);
  notifyListeners();
};

export const useToasts = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setToasts(newToasts);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  return toasts;
};

export const ToastContainer: React.FC = () => {
  const toasts = useToasts();

  return (
    <>
      {toasts.map((toast, index) => (
        <div key={toast.id} style={{ top: `${24 + index * 100}px` }} className="fixed right-6 z-[9999]">
          <CyberpunkToast
            message={toast.message}
            type={toast.type}
            txHash={toast.txHash}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  );
};
