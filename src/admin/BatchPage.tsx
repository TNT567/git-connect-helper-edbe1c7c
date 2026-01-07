import React, { useState } from 'react'
import { useChainConfig } from '../state/useChainConfig'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { ContractPromise } from '@polkadot/api-contract'
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp'

type Row = {
  bookId: number
  code: string
  hash?: string
}

type BatchState = 'idle' | 'parsing' | 'hashing' | 'ready' | 'sending' | 'in-block' | 'success' | 'error'

export default function BatchPage() {
  const { config } = useChainConfig()
  const [rows, setRows] = useState<Row[]>([])
  const [state, setState] = useState<BatchState>('idle')
  const [message, setMessage] = useState<string>('')
  const [txHash, setTxHash] = useState<string>('')

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setState('parsing')
        setMessage('')
        setTxHash('')
        const text = String(reader.result || '')
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        const parsed: Row[] = []
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (!line) continue
          const parts = line.split(',').map((p) => p.trim())
          if (parts.length < 2) continue
          if (i === 0 && parts[0].toLowerCase().includes('book') && parts[1].toLowerCase().includes('secret')) {
            continue
          }
          const id = parseInt(parts[0], 10)
          if (!Number.isFinite(id)) continue
          const code = parts.slice(1).join(',').replace(/^"+|"+$/g, '')
          if (!code) continue
          parsed.push({ bookId: id, code })
        }
        setRows(parsed)
        setState(parsed.length ? 'idle' : 'idle')
        setMessage(parsed.length ? `已解析 ${parsed.length} 条记录` : '未解析到有效数据')
      } catch {
        setState('error')
        setMessage('解析 CSV 失败')
      }
    }
    reader.readAsText(file)
  }

  const computeHashes = async () => {
    if (!rows.length) return
    try {
      setState('hashing')
      setMessage('正在计算 SHA-256 Hash...')
      const enc = new TextEncoder()
      const updated: Row[] = []
      for (const row of rows) {
        const data = enc.encode(row.code)
        const digest = await crypto.subtle.digest('SHA-256', data)
        const bytes = new Uint8Array(digest)
        const hex = '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
        updated.push({ ...row, hash: hex })
      }
      setRows(updated)
      setState('ready')
      setMessage(`已为 ${updated.length} 条记录生成 Hash`)
    } catch {
      setState('error')
      setMessage('Hash 计算失败')
    }
  }

  const handleSubmit = async () => {
    if (!rows.length) {
      setMessage('请先导入 CSV')
      return
    }
    const invalid = rows.some((r) => !r.hash)
    if (invalid) {
      setMessage('请先生成所有 Hash')
      return
    }
    if (!config.contractAddress || !config.abiUrl) {
      setState('error')
      setMessage('未配置合约地址或 ABI')
      return
    }
    try {
      setState('sending')
      setMessage('正在构造交易...')
      setTxHash('')
      const provider = new WsProvider(config.endpoint)
      const api = await ApiPromise.create({ provider })
      const exts = await web3Enable('Whale Vault DApp')
      if (!exts || exts.length === 0) {
        setState('error')
        setMessage('未检测到钱包扩展')
        return
      }
      let address = ''
      try {
        address = localStorage.getItem('selectedAddress') || ''
      } catch {}
      if (!address) {
        const accs = await web3Accounts()
        address = accs[0]?.address ?? ''
      }
      if (!address) {
        setState('error')
        setMessage('未找到账户')
        return
      }
      const injector = await web3FromAddress(address)
      const res = await fetch(config.abiUrl)
      const abi = await res.json()
      const contract = new ContractPromise(api, abi, config.contractAddress)
      const ids = rows.map((r) => r.bookId)
      const hashes = rows.map((r) => r.hash as string)
      const query = await contract.query.add_book_batch(
        address,
        { value: 0, gasLimit: -1, storageDepositLimit: null },
        ids,
        hashes
      )
      if (query.result.isErr) {
        setState('error')
        setMessage('模拟执行失败，可能不是 Owner')
        return
      }
      const gas = query.gasRequired
      const stor = query.storageDeposit?.isCharge ? query.storageDeposit.asCharge : null
      const tx = contract.tx.add_book_batch(
        { value: 0, gasLimit: gas, storageDepositLimit: stor },
        ids,
        hashes
      )
      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(address, { signer: injector.signer }, (result) => {
          if (result.status.isInBlock) {
            setState('in-block')
            setMessage(`已进入区块 ${result.status.asInBlock.toString()}`)
            setTxHash(result.status.asInBlock.toString())
          } else if (result.status.isFinalized) {
            const failed = result.events.some(
              ({ event }) => event.section === 'system' && event.method === 'ExtrinsicFailed'
            )
            if (failed) {
              setState('error')
              setMessage('批次写入失败')
              reject(new Error('ExtrinsicFailed'))
            } else {
              setState('success')
              setMessage(`已最终确认 ${result.status.asFinalized.toString()}`)
              setTxHash(result.status.asFinalized.toString())
              resolve()
            }
          }
        }).catch((e) => reject(e))
      })
    } catch {
      setState('error')
      setMessage('批次创建流程失败')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">批次创建</h1>
        <p className="text-sm text-white/60">
          导入包含 book_id 和 Secret Code 的 CSV，前端计算 SHA-256 后一次性写入链上。
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-sm text-white/70">
              CSV 格式示例：<span className="font-mono text-xs">book_id,secret_code</span>（首行为表头可选）。
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
              className="text-sm text-white/70"
            />
            <div className="flex gap-3">
              <button
                className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-sm transition"
                onClick={computeHashes}
                disabled={!rows.length || state === 'hashing'}
              >
                {state === 'hashing' ? '计算中...' : '生成 SHA-256 Hash'}
              </button>
              <button
                className="rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary px-4 py-2 text-sm transition shadow-glow"
                onClick={handleSubmit}
                disabled={!rows.length || rows.some((r) => !r.hash) || state === 'sending' || state === 'in-block'}
              >
                {state === 'sending' ? '发送中...' : state === 'in-block' ? '区块确认中...' : '批量写入链上'}
              </button>
            </div>
            {message && <div className="text-sm text-white/70">{message}</div>}
            {txHash && (
              <div className="text-xs text-white/60 break-all">
                Tx: {txHash}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-4 max-h-[420px] overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">预览（最多显示前 20 条）</div>
            <div className="text-xs text-white/60">{rows.length} 条</div>
          </div>
          <table className="min-w-full text-xs">
            <thead className="bg-black/40 text-white/60">
              <tr>
                <th className="px-2 py-1 text-left font-normal">Book ID</th>
                <th className="px-2 py-1 text-left font-normal">Secret Code</th>
                <th className="px-2 py-1 text-left font-normal">SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white/0' : 'bg-black/20'}>
                  <td className="px-2 py-1">{r.bookId}</td>
                  <td className="px-2 py-1 max-w-[140px] truncate" title={r.code}>{r.code}</td>
                  <td className="px-2 py-1 max-w-[220px] truncate" title={r.hash || ''}>{r.hash || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="text-sm text-white/60 mt-4">
              还没有数据，请先上传 CSV。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

