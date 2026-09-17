'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, ArrowUpToLine, Database } from 'lucide-react'

const nav = [
  { href: '/dashboard', icon: Home, label: 'Dashboard', minRole: 'viewer' as const },
  { href: '/search', icon: Search, label: 'Search claims', minRole: 'viewer' as const },
  { href: '/bulk-census', icon: ArrowUpToLine, label: 'Bulk census', minRole: 'viewer' as const },
  { href: '/database-management', icon: Database, label: 'Database management', minRole: 'admin' as const },
]

export default function SidebarNav({ role }: { role: string }) {
  const pathname = usePathname()

  return (
    <nav className="grid gap-1">
      {nav
        .filter((item) => item.minRole === 'viewer' || role === 'admin')
        .map(({ href, icon: Icon, label}) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 font-semibold transition ${
                active ? 'bg-blue-50 text-brand' : 'text-ink hover:bg-stone-50'
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          )
        })}
    </nav>
  )
}
