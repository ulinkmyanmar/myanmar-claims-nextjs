import Link from 'next/link'
import { Activity, Database, FileSpreadsheet, Search, ShieldCheck, Eye } from 'lucide-react'
import { getCurrentUserProfile } from '@/lib/supabase-server'
import LogoutButton from './LogoutButton'

const nav = [
  ['/dashboard', Activity, 'Dashboard', 'viewer'],
  ['/search', Search, 'Search Member', 'viewer'],
  ['/bulk-census', FileSpreadsheet, 'Bulk Census', 'viewer'],
  ['/database-management', Database, 'Database', 'admin'],
  ['/audit-logs', Eye, 'Audit Logs', 'admin'],
] as const

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()
  const role = profile?.role ?? 'viewer'

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      <aside className="border-r border-line bg-white p-6">
        <div className="mb-8 flex items-center gap-2 text-lg font-bold text-brand">
          <ShieldCheck /> Myanmar Claims
        </div>
        <nav className="grid gap-2">
          {nav
            .filter(([, , , minRole]) => minRole === 'viewer' || role === 'admin')
            .map(([href, Icon, label]) => (
              <Link className="rounded-xl px-3 py-3 font-semibold hover:bg-blue-50" href={href} key={href}>
                <span className="inline-flex items-center gap-2">
                  <Icon size={18} />
                  {label}
                </span>
              </Link>
            ))}
        </nav>
      </aside>
      <main>
        <header className="flex items-center justify-between border-b border-line bg-white px-8 py-5">
          <div>
            <b>Welcome, {profile?.full_name ?? 'User'}</b>
            <p className="text-sm text-muted">Historical claims covered through 30-Jun-2026</p>
          </div>
          <LogoutButton />
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
