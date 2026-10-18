'use client'

import { useEffect, useState } from 'react'

type Factor = { id: string; friendly_name?: string | null; status?: string; factor_type?: string }

export default function SecuritySettingsClient() {
  const [factors, setFactors] = useState<Factor[]>([])
  const [deviceName, setDeviceName] = useState('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function refreshFactors() {
    try {
      const res = await fetch('/api/auth/mfa/factors', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to list authenticators.')
      setFactors(Array.isArray(data.factors) ? data.factors : [])
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to list authenticators.')
    }
  }

  useEffect(() => { void refreshFactors() }, [])

  async function startEnroll() {
    if (!deviceName.trim()) { setMessage('Please enter a device name.'); return }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/mfa/factors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendlyName: deviceName.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to start MFA enrollment.')
      setQrCode(data.qrCode)
      setFactorId(data.factorId)
      setCode('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start MFA enrollment.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnroll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!factorId) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Invalid code. Please try again.')
      setMessage(`Authenticator "${deviceName}" has been activated for this account.`)
      setQrCode(null)
      setFactorId(null)
      setDeviceName('')
      setCode('')
      await refreshFactors()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid max-w-lg gap-6">
      <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
      <p className="text-muted">Register an authenticator for your own login account. Each authenticator needs a different device name.</p>

      <div className="grid gap-2 rounded-xl border border-line p-4">
        <h2 className="font-semibold">Registered authenticators</h2>
        {factors.length === 0 ? <p className="text-sm text-muted">No authenticators listed for this account.</p> : (
          <ul className="list-disc pl-5 text-sm">
            {factors.map(f => <li key={f.id}>{f.friendly_name || 'Unnamed authenticator'} — {f.status || 'Status unknown'}</li>)}
          </ul>
        )}
        <button type="button" className="btn-secondary w-fit" onClick={() => void refreshFactors()}>Refresh list</button>
      </div>

      {!qrCode ? (
        <div className="grid gap-3">
          <label className="label">New authenticator name
            <input className="input mt-1" type="text" maxLength={60} value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="e.g. Admin 2 phone" />
          </label>
          <button type="button" className="btn w-fit" disabled={busy || !deviceName.trim()} onClick={() => void startEnroll()}>
            {busy ? 'Preparing...' : 'Add authenticator'}
          </button>
        </div>
      ) : (
        <form onSubmit={confirmEnroll} className="grid gap-4">
          <p className="text-sm">Scan this QR code on <b>{deviceName}</b> and enter its six-digit code.</p>
          <div dangerouslySetInnerHTML={{ __html: qrCode }} />
          <label className="label">Authenticator code
            <input className="input mt-1" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required />
          </label>
          <button className="btn w-fit justify-center" disabled={busy || code.length !== 6} type="submit">{busy ? 'Verifying...' : 'Confirm & activate'}</button>
          <p className="text-xs text-muted">Do not leave this page until verification is complete. Existing authenticators are not changed.</p>
        </form>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  )
}
