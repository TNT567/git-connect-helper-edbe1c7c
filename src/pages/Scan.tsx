import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto'
import { Scanner } from '@yudiel/react-qr-scanner'

export default function Scan() {
  const navigate = useNavigate()
  const [recipient, setRecipient] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [showScanner, setShowScanner] = useState<boolean>(false)
  const base58LikeRegex = useMemo(() => /^[1-9A-HJ-NP-Za-km-z]+$/, [])

  const validateAddress = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return '地址不能为空'
    if (trimmed.startsWith('0x')) return '不支持以太坊地址，请使用波卡(Polkadot)地址'
    if (!base58LikeRegex.test(trimmed)) return '无效的波卡地址，请检查后重新输入'
    try {
      decodeAddress(trimmed)
    } catch {
      return '无效的波卡地址，请检查后重新输入'
    }
    return null
  }

  const normalizeToPolkadot = (addr: string) => {
    try {
      const pub = decodeAddress(addr.trim())
      const polkadotAddr = encodeAddress(pub, 0)
      return polkadotAddr
    } catch {
      return addr.trim()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateAddress(recipient)
    if (err) {
      setError(err)
      return
    }
    if (!code.trim()) {
      setError('请填写 Secret Code')
      return
    }
    setError('')
    const normalized = normalizeToPolkadot(recipient)
    navigate(`/mint-confirm?code=${encodeURIComponent(code.trim())}&recipient=${encodeURIComponent(normalized)}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold mb-4">填写信息领取 NFT</h1>
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
        <div className="text-sm text-white/70">
          下载安装使用说明书：推荐安装{' '}
          <a href="https://talisman.xyz" target="_blank" rel="noreferrer" className="text-primary underline hover:text-primary/80">
            Talisman
          </a>{' '}
          或{' '}
          <a href="https://subwallet.app" target="_blank" rel="noreferrer" className="text-primary underline hover:text-primary/80">
            SubWallet
          </a>{' '}
          插件，妥善保存助记词，并复制以 1 开头的地址。
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <div className="text-sm text-white/70 mb-1">波卡钱包地址（必填）</div>
            <input
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-primary/60 font-mono text-sm"
              placeholder="请输入您的波卡钱包地址（以 1 开头）"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              onBlur={() => {
                if (!recipient.trim()) return
                const err = validateAddress(recipient)
                if (err) {
                  setError(err)
                  return
                }
                const normalized = normalizeToPolkadot(recipient)
                setRecipient(normalized)
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-white/70">Secret Code（如有）</div>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-full border border-primary/40 text-primary bg-primary/10 hover:bg-primary/20 transition"
                onClick={() => setShowScanner(true)}
              >
                扫码填入
              </button>
            </div>
            <input
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-primary/60 font-mono text-sm"
              placeholder="请输入书上的兑换码或扫码得到的 Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button
            type="submit"
            className="w-full rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary px-4 py-2 transition shadow-glow"
          >
            前往确认页
          </button>
        </form>
      </div>
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowScanner(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-white/10 bg-background p-4 space-y-3 shadow-glow">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">扫码获取 Secret Code</div>
              <button
                type="button"
                className="text-xs text-white/60 hover:text-white"
                onClick={() => setShowScanner(false)}
              >
                关闭
              </button>
            </div>
            <div className="rounded-lg overflow-hidden border border-white/10 bg-black/60">
              <Scanner
                onScan={(results) => {
                  const first = Array.isArray(results) ? results[0] : null
                  const value = first?.rawValue ?? ''
                  if (value) {
                    setCode(value)
                    setShowScanner(false)
                  }
                }}
                onError={() => {}}
                constraints={{ facingMode: 'environment' }}
              />
            </div>
            <div className="text-xs text-white/60">将摄像头对准书上的二维码，即可自动填入 Code。</div>
          </div>
        </div>
      )}
    </div>
  )
}
