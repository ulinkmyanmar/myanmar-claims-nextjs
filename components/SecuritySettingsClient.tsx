'use client'
import { useState } from 'react'

export default function SecuritySettingsClient() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function startEnroll() {
    setMessage(null)
    const res = await fetch('/api/auth/mfa/factors', { method: 'POST' })
    const data = await res.json()
    if (!data.ok) {
      setMessage(data.error || 'Failed to start MFA enrollment.')
      return
    }
    setQrCode(data.qrCode)
    setFactorId(data.factorId)
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId, code }),
    })
    const data = await res.json()
    if (!data.ok) {
      setMessage(data.error || 'Invalid code. Please try again.')
      return
    }
    setMessage('Two-factor authentication has been enabled for this account.')
    setQrCode(null)
  }

  return (
    <section className="grid gap-6 max-w-lg">
      <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
      <p className="text-muted">
        Add an extra verification step at login using an authenticator app (e.g. Google Authenticator, Authy).
      </p>

      {!qrCode && (
        <button className="btn w-fit" onClick={startEnroll}>
          Set up two-factor authentication
        </button>
      )}

      {qrCode && (
        <form onSubmit={confirmEnroll} className="grid gap-4">
          <div dangerouslySetInnerHTML={{ __html: qrCode }} />
          <label className="label">
            Enter the 6-digit code shown in your authenticator app
            <input
              className="input mt-1"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          <button className="btn w-fit justify-center">Confirm & activate</button>
        </form>
      )}

      {message && <p className="text-sm">{message}</p>}
    </section>
  )
}
