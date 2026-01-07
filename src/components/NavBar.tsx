import React from 'react'
import { Link } from 'react-router-dom'
import { usePolkadotWallet } from '../hooks/usePolkadotWallet'
import { formatAddress } from '../utils/formatAddress'
import AccountSelector from './AccountSelector'

export default function NavBar() {
  const { selected, connecting, connect, disconnect, isConnected, error } = usePolkadotWallet()

  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-black/30 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-accent to-primary shadow-glow" />
          <Link to="/" className="font-semibold tracking-wide hover:text-primary transition">
            Whale Vault
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/overview"
            className="hidden md:inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10 transition"
          >
            管理后台
          </Link>
          {error && <span className="text-red-400 text-sm">{error}</span>}
          {isConnected && selected ? (
            <>
              <AccountSelector />
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10 transition text-sm"
                onClick={disconnect}
              >
                断开
              </button>
            </>
          ) : (
            <button
              className="rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary px-4 py-2 text-sm font-medium transition shadow-glow"
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? '连接中...' : '连接钱包'}
            </button>
          )}
          <Link to="/settings" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10 transition text-sm">
            设置
          </Link>
        </div>
      </div>
    </header>
  )
}
