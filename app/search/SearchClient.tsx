'use client'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Claim = {
  id: number
  claim_no: string
  client_name: string
  passport_no: string | null
  contact_no: string | null
  email: string | null
  claim_status: string
  claim_type: string
  incident_date: string | null
  incident_country: string | null
  description: string | null
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
}

function statusPill(status: string) {
  const cls =
    status === 'Completed' ? 'pill-green' :
    status === 'Pending' ? 'pill-gray' :
    'pill-gray'
  return <span className={`pill ${cls}`}>{status}</span>
}

export default function SearchClient({ initialQuery }: { initialQuery?: string }) {
  const [keyword, setKeyword] = useState(initialQuery ?? '')
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  async function runSearch(q: string) {
    const res = await fetch(`/api/claims/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setClaims(data.claims ?? [])
  }

  useEffect(() => {
    if (initialQuery) runSearch(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) return
    runSearch(keyword.trim())
  }

  // Group claims by client (name + passport) since there's no separate member table
  const groups = useMemo(() => {
    if (!claims) return []
    const map = new Map<string, { key: string; client_name: string; passport_no: string | null; claims: Claim[] }>()
    for (const c of claims) {
      const key = `${c.client_name}|${c.passport_no ?? ''}`
      if (!map.has(key)) map.set(key, { key, client_name: c.client_name, passport_no: c.passport_no, claims: [] })
      map.get(key)!.claims.push(c)
    }
    return Array.from(map.values())
  }, [claims])

  const selected = groups.find((g) => g.key === selectedKey) ?? groups[0] ?? null

  return (
    <div className="grid grid-cols-[1.15fr_.85fr] gap-6">
      <section className="card">
        <h1 className="text-2xl font-bold">Individual Member Search</h1>
        <p className="mt-2 text-muted">
          Search by client name, claim number, or passport number.
        </p>
        <form onSubmit={submit} className="mt-6 flex gap-3">
          <input
            className="input"
            placeholder="Name, Claim No, or Passport No"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button className="btn shrink-0">
            <Search size={18} /> Search
          </button>
        </form>

        {claims && (
          <div className="mt-8">
            <h2 className="font-bold">Search Results</h2>
            {groups.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-line bg-stone-50 p-8 text-center">
                <b>No matching claims history found</b>
                <p className="mt-2 text-muted">This only means no matching claim is available in the current historical database snapshot.</p>
              </div>
            ) : (
              <table className="mt-3 w-full border-collapse">
                <thead>
                  <tr><th>Client Name</th><th>Passport No</th><th>Claims</th></tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.key} onClick={() => setSelectedKey(g.key)} className="cursor-pointer">
                      <td>{g.client_name}</td>
                      <td>{g.passport_no ?? '—'}</td>
                      <td>{g.claims.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      <section className="card">
        {!selected ? (
          <div className="grid min-h-80 place-items-center text-center text-muted">
            Select a matched member to view full claims history.
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold">Member Detail</h2>
            <div className="mt-4 grid grid-cols-[160px_1fr] gap-2 rounded-2xl border border-line bg-stone-50 p-4">
              <span className="text-muted">Full Name</span><b>{selected.client_name}</b>
              <span className="text-muted">Passport No</span><b>{selected.passport_no ?? '—'}</b>
              <span className="text-muted">Unique Claim Count</span><b>{selected.claims.length}</b>
            </div>
            <h3 className="mt-6 font-bold">All Claim History</h3>
            {selected.claims.map((c, i) => (
              <div key={c.id} className="mt-3 rounded-2xl border border-line p-4">
                <div className="flex items-center justify-between">
                  <b>Claim {i + 1}: {c.claim_no}</b>
                  {statusPill(c.claim_status)}
                </div>
                <p className="text-sm text-muted mt-1">
                  Type: {c.claim_type} · Incident: {fmtDate(c.incident_date)} · Country: {c.incident_country ?? '—'}
                </p>
                <p className="mt-1">{c.description}</p>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  )
}