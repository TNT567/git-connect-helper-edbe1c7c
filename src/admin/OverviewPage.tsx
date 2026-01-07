import React, { useMemo } from 'react'
import { getOverview } from './mock'

export default function OverviewPage() {
  const data = useMemo(() => getOverview(), [])
  const grouped = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of data.series) {
      const key = `${item.date}-${item.bookId}`
      map[key] = (map[key] || 0) + item.count
    }
    return map
  }, [data])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">数据总览</h1>
        <p className="text-sm text-white/60">基于 Mock 数据的销售表现，后续可对接链上统计。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60 mb-1">累计销售额</div>
          <div className="text-2xl font-semibold text-primary">◎ {data.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/60 mb-1">已 Mint 数量</div>
          <div className="text-2xl font-semibold">{data.mintedCount}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-400/10 p-4 shadow-glow">
          <div className="text-xs text-emerald-200 mb-1">当前可提现余额</div>
          <div className="text-2xl font-semibold text-emerald-300">◎ {data.withdrawable.toFixed(2)}</div>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">最近 14 天销售曲线（Mock）</h2>
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" /> Book 1
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-accent" /> Book 2
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Book 3
            </span>
          </div>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {Array.from(new Set(data.series.map((s) => s.date))).map((date) => {
            const items = data.series.filter((s) => s.date === date)
            const total = items.reduce((acc, x) => acc + x.count, 0)
            if (!total) return null
            return (
              <div key={date} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>{date}</span>
                  <span>{total} 次 Mint</span>
                </div>
                <div className="flex gap-1 h-3 rounded-full bg-black/40 border border-white/5 overflow-hidden">
                  {items.map((item) => {
                    const ratio = item.count / total
                    const color =
                      item.bookId === 1 ? 'bg-primary' : item.bookId === 2 ? 'bg-accent' : 'bg-emerald-400'
                    return <div key={item.bookId} className={`${color}`} style={{ width: `${ratio * 100}%` }} />
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

