'use client'
import { Search, Download } from 'lucide-react'
import { excelDateStamp, exportExcel } from '@/lib/excel-export'
import { useEffect, useMemo, useState } from 'react'
import { COVERAGE_DATE } from '@/lib/constants'

type Claim = {
  id: number
  member_id: number
  member_name: string
  date_of_birth: string | null
  gender: string | null
  claim_no: string
  claim_status: string | null
  claim_type: string | null
  incident_date: string | null
  incident_country: string | null
  description: string | null
}

type FormState = { name: string; dob: string; gender: string }
const EMPTY_FORM: FormState = { name: '', dob: '', gender: '' }

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
}

function statusPill(status: string | null) {
  const cls = status === 'Completed' ? 'pill-green' : 'pill-gray'
  return <span className={`pill ${cls}`}>{status ?? '—'}</span>
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
      setSelectedKey(null)
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
    const dob = form.dob.trim()
    const gender = form.gender.trim()
    if (!name && !dob && !gender) {
      setError('Enter at least one field to search.')
      return
    }
    const params = new URLSearchParams()
    if (name) params.set('name', name)
    if (dob) params.set('dob', dob)
    if (gender) params.set('gender', gender)
    runSearch(params)
  }

  function downloadResults() {
    if (!claims?.length) return
    const headers = [
      'Member ID', 'Member Name', 'Date of Birth', 'Gender', 'Claim No',
      'Claim Status', 'Claim Type', 'Incident Date', 'Incident Country', 'Description',
    ]
    const rows = claims.map((c) => ({
      'Member ID': String(c.member_id).padStart(6, '0'),
      'Member Name': c.member_name,
      'Date of Birth': c.date_of_birth,
      Gender: c.gender,
      'Claim No': c.claim_no,
      'Claim Status': c.claim_status,
      'Claim Type': c.claim_type,
      'Incident Date': c.incident_date,
      'Incident Country': c.incident_country,
      Description: c.description,
    }))
    exportExcel(`Myanmar_Claims_Search_${excelDateStamp()}.xlsx`, [
      { name: 'Search Results', rows, headers },
    ])
  }

  function clearAll() {
    setForm(EMPTY_FORM)
    setClaims(null)
    setSelectedKey(null)
    setError(null)
  }

  // Member ID is the sole identity key; same-name members stay separate.
  const groups = useMemo(() => {
    if (!claims) return []
    const map = new Map<number, { key: string; member_id: number; client_name: string; dob: string | null; gender: string | null; claims: Claim[] }>()
    for (const c of claims) {
      if (!map.has(c.member_id)) map.set(c.member_id, {
        key: String(c.member_id), member_id: c.member_id, client_name: c.member_name,
        dob: c.date_of_birth, gender: c.gender, claims: [],
      })
      map.get(c.member_id)!.claims.push(c)
    }
    return Array.from(map.values()).sort((a, b) => a.member_id - b.member_id)
  }, [claims])

  const selected = groups.find((g) => g.key === selectedKey) ?? groups[0] ?? null

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Claims data coverage:</strong> Current historical claims are covered through{' '}
        <strong>{COVERAGE_DATE}</strong>. A claim approved after this date may not appear until the next
        database synchronization.
      </div>

      <div className="grid grid-cols-[1.15fr_.85fr] gap-6">
        <section className="card">
          <h1 className="text-2xl font-bold">Search claims history</h1>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>Search guidance:</strong> Search by Name, Date of Birth or Gender, individually or in combination.
            Results are grouped by permanent Member ID.
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
              Date of Birth
              <input className="input mt-1" type="date" value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </label>
            <label className="label">
              Gender
              <select className="input mt-1" value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Any gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">Search Results</h2>
                <button type="button" className="btn-secondary" onClick={downloadResults} disabled={!claims.length || searching}>
                  <Download size={18} /> Export to Excel
                </button>
              </div>
              {groups.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-line bg-stone-50 p-8 text-center">
                  <b>No matching claims history found</b>
                  <p className="mt-2 text-muted">This only means no matching claim is available in the current historical database snapshot.</p>
                </div>
              ) : (
                <table className="mt-3 w-full border-collapse">
                  <thead>
                    <tr><th>Member ID</th><th>Client Name</th><th>DOB</th><th>Gender</th><th>Claims</th></tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.key} onClick={() => setSelectedKey(g.key)} className="cursor-pointer">
                        <td>{String(g.member_id).padStart(6, '0')}</td>
                        <td>{g.client_name}</td>
                        <td>{fmtDate(g.dob)}</td>
                        <td>{g.gender ?? '—'}</td>
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
                <span className="text-muted">Member ID</span><b>{String(selected.member_id).padStart(6, '0')}</b>
                <span className="text-muted">Date of Birth</span><b>{fmtDate(selected.dob)}</b>
                <span className="text-muted">Gender</span><b>{selected.gender ?? '—'}</b>
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
