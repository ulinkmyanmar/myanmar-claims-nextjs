'use client'
import { Search } from 'lucide-react'
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

    const params = new URLSearchParams()
    if (name) params.set('name', name)
    if (nrc) params.set('nrc', nrc)
    if (dob) params.set('dob', dob)
    if (gender) params.set('gender', gender)
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
