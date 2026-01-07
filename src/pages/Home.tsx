import React from 'react'
import { Link } from 'react-router-dom'
import SalesBoard from '../components/SalesBoard'

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold mb-2">NFT 金库</h2>
          <p className="text-sm text-white/70 mb-4">连接钱包后管理你的 Ink! NFT 资产。</p>
          <Link
            className="inline-flex items-center rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary px-4 py-2 transition shadow-glow"
            to="/scan"
          >
            扫描 Secret Code
          </Link>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <SalesBoard />
        </div>
      </section>
    </div>
  )
}
