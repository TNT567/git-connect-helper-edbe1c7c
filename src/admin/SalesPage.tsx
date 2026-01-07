import React, { useMemo } from 'react'
import { getSales } from './mock'

export default function SalesPage() {
  const rows = useMemo(() => getSales(), [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">销量明细</h1>
        <p className="text-sm text-white/60">基于 Mock 的 Mint 记录，用于预览表格结构和样式。</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="max-h-[460px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/40 text-white/60">
              <tr>
                <th className="px-3 py-2 text-left font-normal">时间戳</th>
                <th className="px-3 py-2 text-left font-normal">Book ID</th>
                <th className="px-3 py-2 text-left font-normal">交易哈希</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white/0' : 'bg-black/20'}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(row.timestamp * 1000).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{row.book_id}</td>
                  <td className="px-3 py-2">
                    <a
                      href="#"
                      className="font-mono text-xs text-primary hover:text-primary/70 break-all"
                    >
                      {row.tx_hash}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/60">暂无数据</div>
          )}
        </div>
      </div>
    </div>
  )
}

