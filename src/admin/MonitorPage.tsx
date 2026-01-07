import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useChainConfig } from '../state/useChainConfig'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { ContractPromise } from '@polkadot/api-contract'
import { web3Enable, web3Accounts } from '@polkadot/extension-dapp'
import { formatAddress } from '../utils/formatAddress'

type Overview = {
  totalRevenue: number
  mintedCount: number
  withdrawable: number
}

type ChartPoint = {
  date: string
  minted: number
}

type Row = {
  timestamp: number
  bookId: number
  address: string
  status: string
}

export default function MonitorPage() {
  const { config } = useChainConfig()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [points, setPoints] = useState<ChartPoint[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const mock = buildMockData()
        setOverview(mock.overview)
        setPoints(mock.points)
        setRows(mock.rows)
        if (config.contractAddress && config.abiUrl) {
          try {
            const stats = await loadOnchainStats(config)
            if (stats) {
              setOverview((prev) =>
                prev
                  ? {
                      totalRevenue: prev.totalRevenue + stats.extraRevenue,
                      mintedCount: prev.mintedCount + stats.usedCount,
                      withdrawable: prev.withdrawable + stats.withdrawable
                    }
                  : prev
              )
            }
          } catch {
            setError('链上统计加载失败，仅展示 Mock 数据')
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [config])

  const totalDays = useMemo(() => points.length, [points])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">销量监控看板</h1>
        <p className="text-sm text-white/60">
          结合链上只读统计与 Mock 数据，展示近 30 天的销售趋势与最新 Mint 明细。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60 mb-1">总销售额</div>
          <div className="text-2xl font-semibold text-primary">
            {overview ? `◎ ${overview.totalRevenue.toFixed(2)}` : '--'}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60 mb-1">已铸造 NFT 数量</div>
          <div className="text-2xl font-semibold">
            {overview ? overview.mintedCount : '--'}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-400/10 p-4 shadow-glow">
          <div className="text-xs text-emerald-200 mb-1">待提现余额</div>
          <div className="text-2xl font-semibold text-emerald-300">
            {overview ? `◎ ${overview.withdrawable.toFixed(2)}` : '--'}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">近 30 天销售增长曲线</h2>
            <p className="text-xs text-white/60">
              以每日 Mint 数量为基准绘制累计曲线，总计 {totalDays} 天。
            </p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#020617', borderColor: '#1f2937', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="minted"
                name="每日 Mint 数量"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">最近 Mint 明细</h2>
            <p className="text-xs text-white/60">
              展示最新的铸造记录，包括 book_id、用户地址与交易状态。
            </p>
          </div>
          {loading && <div className="text-xs text-white/60">加载中...</div>}
        </div>
        {error && <div className="text-xs text-red-400 mb-2">{error}</div>}
        <div className="max-h-72 overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-black/40 text-white/60">
              <tr>
                <th className="px-2 py-1 text-left font-normal">时间</th>
                <th className="px-2 py-1 text-left font-normal">Book ID</th>
                <th className="px-2 py-1 text-left font-normal">用户地址</th>
                <th className="px-2 py-1 text-left font-normal">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white/0' : 'bg-black/20'}>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {new Date(r.timestamp * 1000).toLocaleString()}
                  </td>
                  <td className="px-2 py-1">{r.bookId}</td>
                  <td className="px-2 py-1 font-mono">
                    {formatAddress(r.address)}
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={
                        r.status === '已确认'
                          ? 'text-emerald-400'
                          : r.status === '待确认'
                          ? 'text-amber-300'
                          : 'text-red-400'
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-2 py-3 text-center text-white/60" colSpan={4}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function buildMockData() {
  const now = new Date()
  const points: ChartPoint[] = []
  const rows: Row[] = []
  const addresses = [
    '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    '5DAAnrj7VHTz5kqf2yaC5pNSmQ7qf4Y2s9wS9qboP9G8d5jY'
  ]
  let totalMinted = 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000)
    const date = d.toISOString().slice(5, 10)
    const minted = Math.floor(Math.random() * 15)
    totalMinted += minted
    points.push({ date, minted })
    for (let j = 0; j < minted; j++) {
      const ts = Math.floor(d.getTime() / 1000) + j * 600
      const bookId = 1 + (j % 3)
      const address = addresses[(i + j) % addresses.length]
      const status = j % 7 === 0 ? '待确认' : '已确认'
      rows.push({ timestamp: ts, bookId, address, status })
    }
  }
  const totalRevenue = totalMinted * 1.2
  const withdrawable = totalRevenue * 0.25
  const overview: Overview = {
    totalRevenue,
    mintedCount: totalMinted,
    withdrawable
  }
  rows.sort((a, b) => b.timestamp - a.timestamp)
  return { overview, points, rows: rows.slice(0, 40) }
}

async function loadOnchainStats(config: { endpoint: string; contractAddress: string; abiUrl: string }) {
  const provider = new WsProvider(config.endpoint)
  const api = await ApiPromise.create({ provider })
  const exts = await web3Enable('Whale Vault DApp')
  if (!exts || exts.length === 0) {
    return null
  }
  const accs = await web3Accounts()
  const address = accs[0]?.address
  if (!address) {
    return null
  }
  const res = await fetch(config.abiUrl)
  const abi = await res.json()
  const contract = new ContractPromise(api, abi, config.contractAddress)
  try {
    const query = await contract.query.has_access(
      address,
      { value: 0, gasLimit: -1, storageDepositLimit: null },
      address,
      1
    )
    if (query.result.isErr) {
      return null
    }
    const out = query.output?.toJSON() as any
    const used = typeof out === 'boolean' ? out : !!(out && (out.ok ?? out.Ok))
    return {
      usedCount: used ? 1 : 0,
      extraRevenue: used ? 1.2 : 0,
      withdrawable: used ? 0.3 : 0
    }
  } catch {
    return null
  }
}

