import React from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-950 via-slate-900 to-black">
      <aside className="w-64 border-r border-white/10 bg-black/40 backdrop-blur hidden md:flex flex-col">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-accent to-primary shadow-glow" />
          <div>
            <div className="text-sm text-white/60">Whale Vault</div>
            <div className="text-xs text-white/40">作者 / 出版社后台</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem to="/admin/overview" label="数据总览" />
          <NavItem to="/admin/monitor" label="销量监控" />
          <NavItem to="/admin/sales" label="销量明细" />
          <NavItem to="/admin/withdraw" label="财务提现" />
          <NavItem to="/admin/batch" label="批次创建" />
        </nav>
        <div className="px-4 py-4 border-t border-white/10 text-xs text-white/40">
          <Link to="/" className="hover:text-primary transition">
            返回用户端
          </Link>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b border-white/10 bg-black/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-accent to-primary shadow-glow" />
            <div>
              <div className="text-sm text-white/80">Whale Vault</div>
              <div className="text-xs text-white/50">创作者后台</div>
            </div>
          </div>
          <Link
            to="/"
            className="text-xs rounded-full border border-white/10 px-3 py-1 text-white/70 hover:bg-white/10 transition"
          >
            返回用户端
          </Link>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition',
          isActive ? 'bg-primary/20 text-primary border border-primary/40 shadow-glow' : 'text-white/70 hover:bg-white/5'
        ].join(' ')
      }
    >
      <span>{label}</span>
    </NavLink>
  )
}
