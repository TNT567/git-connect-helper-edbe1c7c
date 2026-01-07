import { useCallback, useEffect, useState } from 'react'
import { web3Enable, web3Accounts } from '@polkadot/extension-dapp'

type Account = { address: string; meta?: { name?: string } }

export function usePolkadotWallet() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState<Account | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    try {
      setConnecting(true)
      setError(null)
      const exts = await web3Enable('Whale Vault DApp')
      if (!exts || exts.length === 0) {
        setError('未检测到 Polkadot{.js} 扩展')
        return
      }
      const accs = await web3Accounts()
      setAccounts(accs)
      const first = accs[0] ?? null
      setSelected(first)
      if (first?.address) {
        try {
          localStorage.setItem('selectedAddress', first.address)
        } catch {}
      }
    } catch {
      setError('连接失败')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAccounts([])
    setSelected(null)
    setError(null)
    try {
      localStorage.removeItem('selectedAddress')
    } catch {}
  }, [])

  const select = useCallback((address: string) => {
    const found = accounts.find((a) => a.address === address) || null
    setSelected(found)
    try {
      localStorage.setItem('selectedAddress', address)
    } catch {}
  }, [accounts])

  useEffect(() => {
    try {
      const addr = localStorage.getItem('selectedAddress')
      if (addr && accounts.length) {
        const found = accounts.find((a) => a.address === addr) || null
        setSelected(found)
      }
    } catch {}
  }, [accounts])

  return {
    accounts,
    selected,
    connecting,
    error,
    connect,
    disconnect,
    select,
    isConnected: !!selected
  }
}
