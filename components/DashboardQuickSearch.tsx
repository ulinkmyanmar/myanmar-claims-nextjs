'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function DashboardQuickSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <form onSubmit={submit} className="mt-4 flex gap-2">
      <input
        className="input"
        placeholder="Search by name or NRC…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button className="btn shrink-0">
        <Search size={18} /> Start search
      </button>
    </form>
  )
}