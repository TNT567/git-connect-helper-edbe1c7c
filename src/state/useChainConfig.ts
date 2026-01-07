import { useEffect, useState } from 'react'

export type ChainConfig = {
  endpoint: string
  contractAddress: string
  abiUrl: string
}

const defaults: ChainConfig = {
  endpoint: 'wss://ws.azero.dev',
  contractAddress: '',
  abiUrl: ''
}

export function useChainConfig() {
  const [config, setConfig] = useState<ChainConfig>(defaults)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('chainConfig')
      if (raw) {
        const parsed = JSON.parse(raw) as ChainConfig
        setConfig({
          endpoint: parsed.endpoint || defaults.endpoint,
          contractAddress: parsed.contractAddress || '',
          abiUrl: parsed.abiUrl || ''
        })
      }
    } catch {}
  }, [])

  const save = (next: ChainConfig) => {
    setConfig(next)
    try {
      localStorage.setItem('chainConfig', JSON.stringify(next))
    } catch {}
  }

  return { config, save }
}
