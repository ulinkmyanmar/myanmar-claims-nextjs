import { ShieldCheck } from 'lucide-react'
import SidebarNav from './SidebarNav'
import LogoutButton from './LogoutButton'
import { getCurrentUserProfile } from '@/lib/supabase-server'

export default async function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
}) {
  const profile = await getCurrentUserProfile()
  const role = profile?.role ?? 'viewer'
  const fullName = profile?.full_name ?? 'Admin Myanmar'
  const initials = fullName
    .split(' ')
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-soft">
      <aside className="flex flex-col border-r border-line bg-white p-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-bold text-white">U</div>
          <b className="tracking-wide">MYANMAR CLAIMS</b>
        </div>

        <SidebarNav role={role} />

        <div className="mt-auto rounded-2xl border border-line p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 font-bold text-brand">
              {initials || 'AM'}
            </div>
            <div>
              <b className="block text-sm">{fullName}</b>
              <span className="text-xs text-muted">{role === 'admin' ? 'Admin role' : 'Viewer role'}</span>
            </div>
          </div>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main>
        <header className="flex items-center justify-between border-b border-line bg-white px-8 py-5">
          <div>
            <b className="text-lg">{title ?? 'Dashboard'}</b>
            <p className="text-sm text-muted">{subtitle ?? 'Claims History Checking System'}</p>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 font-bold text-brand">
            <ShieldCheck size={18} />
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}