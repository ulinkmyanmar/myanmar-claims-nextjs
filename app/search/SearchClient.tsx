'use client'
import { Search, Info } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { COVERAGE_DATE } from '@/lib/constants'

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

type FormState = { name: string; nrc: string; dob: string; gender: string }
const EMPTY_FORM: FormState = { name: '', nrc: '', dob: '', gender: '' }

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
}

function statusPill(status: string) {
  const cls = status === 'Completed' ? 'pill-green' : 'pill-gray'
  return <span className={`pill ${cls}`}>{status}</span>
}

export default function SearchClient({ initialQuery }: { initialQuery?: string }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  async function runSearch(params: URLSearchParams) {
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/claims/search?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Search failed. Please try again.')
        setClaims(null)
        return
      }
      setClaims(data.claims ?? [])
    } catch {
      setError('Could not reach the server. Please try again.')
      setClaims(null)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (initialQuery) runSearch(new URLSearchParams({ q: initialQuery }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    const nrc = form.nrc.trim()
    const dob = form.dob.trim()
    const gender = form.gender.trim()

    if (!name && !nrc && !dob && !gender) {
      setError('Enter at least one field to search.')
      return
    }
    if (!name && !nrc) {
      setError('Date of Birth and Gender are reference-only right now — add a Name or NRC / National ID to search.')
      return
    }

    const params = new URLSearchParams()
    if (name) params.set('name', name)
    if (nrc) params.set('nrc', nrc)
    runSearch(params)
  }

  function clearAll() {
    setForm(EMPTY_FORM)
    setClaims(null)
    setSelectedKey(null)
    setError(null)
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
    <div className="grid gap-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Claims data coverage:</strong> Current historical claims are covered through{' '}
        <strong>{COVERAGE_DATE}</strong>. A claim approved after this date may not appear until the next
        database replacement.
      </div>

      <div className="grid grid-cols-[1.15fr_.85fr] gap-6">
        <section className="card">
          <h1 className="text-2xl font-bold">Search claims history</h1>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>Search guidance:</strong> You can search with only Name, only NRC / National ID, or
            both together. Results are based on the member information provided.
          </div>

          <form onSubmit={submit} className="mt-6 grid grid-cols-2 gap-4">
            <label className="label">
              Name
              <input
                className="input mt-1"
                placeholder="e.g., Yoon Thadar"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="label">
              NRC / National ID
              <input
                className="input mt-1"
                placeholder="e.g., 12/ABC(N)123456"
                value={form.nrc}
                onChange={(e) => setForm({ ...form, nrc: e.target.value })}
              />
            </label>
            <label className="label">
              <span className="flex items-center gap-1">
                Date of Birth
                <span title="Reference only — not yet supported for filtering">
                  <Info size={14} className="text-muted" />
                </span>
              </span>
              <input
                className="input mt-1"
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
              <span className="mt-1 block text-xs text-muted">Reference only, not yet supported for filtering.</span>
            </label>
            <label className="label">
              <span className="flex items-center gap-1">
                Gender
                <span title="Reference only — not yet supported for filtering">
                  <Info size={14} className="text-muted" />
                </span>
              </span>
              <select
                className="input mt-1"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">Any gender</option>
                <option>Female</option>
                <option>Male</option>
              </select>
              <span className="mt-1 block text-xs text-muted">Reference only, not yet supported for filtering.</span>
            </label>

            {error && <p className="error col-span-2">{error}</p>}

            <div className="col-span-2 flex justify-end gap-3">
              <button type="button" onClick={clearAll} className="btn-secondary">
                Clear
              </button>
              <button className="btn" disabled={searching}>
                <Search size={18} /> {searching ? 'Searching…' : 'Search claims history'}
              </button>
            </div>
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
    </div>
  )
}
