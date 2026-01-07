import React, { useState } from 'react'
import { formatAddress } from '../utils/formatAddress'
import { usePolkadotWallet } from '../hooks/usePolkadotWallet'

export default function AccountSelector() {
  const { accounts, selected, select, connect, isConnected } = usePolkadotWallet()
  const [open, setOpen] = useState(false)

  if (!isConnected) {
    return (
      <button
        className="rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary px-4 py-2 text-sm font-medium transition shadow-glow"
        onClick={connect}
      >
        连接钱包
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm font-medium">{selected ? formatAddress(selected.address) : '已连接'}</span>
        <svg className="w-3 h-3 opacity-70" viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-white/10 bg-black/60 backdrop-blur shadow-glow">
          <div className="max-h-64 overflow-auto">
            {accounts.map((a) => (
              <button
                key={a.address}
                onClick={() => {
                  select(a.address)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 hover:bg-white/10 transition ${selected?.address === a.address ? 'bg-white/10' : ''}`}
              >
                <div className="text-xs text-white/70">{a.meta?.name || '账户'}</div>
                <div className="text-sm font-mono">{formatAddress(a.address)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
