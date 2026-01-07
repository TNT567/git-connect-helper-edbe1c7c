import React from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { useNavigate } from 'react-router-dom'

export default function Scan() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold mb-4">扫描实体书 Secret Code</h1>
      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
        <Scanner
          onScan={(results) => {
            const first = Array.isArray(results) ? results[0] : null
            const value = first?.rawValue ?? ''
            if (value) {
              navigate(`/mint-confirm?code=${encodeURIComponent(value)}`)
            }
          }}
          onError={() => {}}
          constraints={{ facingMode: 'environment' }}
        />
      </div>
      <p className="text-sm text-white/60 mt-3">在移动端请允许摄像头权限。</p>
    </div>
  )
}
