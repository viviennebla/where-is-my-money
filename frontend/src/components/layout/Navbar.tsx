import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import SyncStatus from './SyncStatus'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const linkClass = (path: string) =>
    `px-3 py-2 rounded text-sm font-medium ${
      location.pathname === path
        ? 'bg-slate-700 text-white'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`

  return (
    <nav className="bg-slate-800 text-white">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            WIMM
          </Link>
          <Link to="/" className={linkClass('/')}>
            流水
          </Link>
          <Link to="/accounts" className={linkClass('/accounts')}>
            账户
          </Link>
          <Link to="/import" className={linkClass('/import')}>
            导入
          </Link>
          <Link to="/tags" className={linkClass('/tags')}>
            标签
          </Link>
          <Link to="/tag-rules" className={linkClass('/tag-rules')}>
            匹配规则
          </Link>
          <Link to="/settings" className={linkClass('/settings')}>
            设置
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <SyncStatus />
          <span className="text-sm text-slate-400">{user?.email}</span>
          <button
            onClick={logout}
            className="text-sm text-slate-400 hover:text-white"
          >
            退出
          </button>
        </div>
      </div>
    </nav>
  )
}
