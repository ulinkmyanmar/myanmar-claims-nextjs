'use client'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-blue-50 hover:text-brand"
    >
      <LogOut size={16} /> {loading ? 'Signing out…' : 'Log out'}
    </button>
  )
}
