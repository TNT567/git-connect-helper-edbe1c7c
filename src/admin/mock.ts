export type Overview = {
  totalRevenue: number
  mintedCount: number
  withdrawable: number
  series: Array<{ date: string; bookId: number; count: number }>
}

export type SaleRow = {
  timestamp: number
  book_id: number
  tx_hash: string
}

export function getOverview(): Overview {
  const now = Date.now()
  const baseDate = new Date(now - 14 * 24 * 3600 * 1000)
  const series: Overview['series'] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(baseDate.getTime() + i * 24 * 3600 * 1000)
    for (const bookId of [1, 2, 3]) {
      series.push({
        date: d.toISOString().slice(0, 10),
        bookId,
        count: Math.floor(Math.random() * 8) + (bookId - 1) * 2
      })
    }
  }
  const minted = series.reduce((acc, x) => acc + x.count, 0)
  const totalRevenue = minted * 1.5
  const withdrawable = Math.round(totalRevenue * 0.3 * 100) / 100
  return {
    totalRevenue,
    mintedCount: minted,
    withdrawable,
    series
  }
}

export function getSales(): SaleRow[] {
  const rows: SaleRow[] = []
  const now = Math.floor(Date.now() / 1000)
  for (let i = 0; i < 40; i++) {
    const ts = now - i * (3600 + Math.floor(Math.random() * 1800))
    const book = [1, 2, 3][i % 3]
    rows.push({
      timestamp: ts,
      book_id: book,
      tx_hash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
    })
  }
  return rows
}
