'use client'
import { Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // MFA 相关状态
  const [mfaStep, setMfaStep] = useState(false)
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)

  // 新增：Reset Password 相关状态
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResetMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Login failed. Please try again.')
        return
      }

      if (data.mfaRequired) {
        const factorsRes = await fetch('/api/auth/mfa/factors')
        const factorsData = await factorsRes.json()
        const verifiedFactor = factorsData.factors?.find((f: any) => f.status === 'verified')
        if (verifiedFactor) {
          setFactorId(verifiedFactor.id)
          setMfaStep(true)
        } else {
          setError('MFA is required but no verified factor was found. Contact your administrator.')
        }
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // 新增：处理忘密码重置邮件的逻辑
  async function handleForgotPassword() {
    if (!email) {
      setError('Please enter your email first.')
      return
    }

    setError(null)
    setResetMessage(null)
    setResetting(true)

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetErr) {
        setError(resetErr.message)
      } else {
        setResetMessage('Password reset link sent! Please check your email inbox.')
      }
    } catch {
      setError('Failed to send password reset email. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Invalid verification code.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-white to-blue-50 p-6">
      <section className="card w-full max-w-md">
        <div className="mb-4 flex items-center gap-2 font-bold text-brand">
          {mfaStep ? <ShieldCheck /> : <Lock />} Internal Secure Platform
        </div>
        <h1 className="mb-3 text-3xl font-bold leading-tight">Myanmar Claims History Checking System</h1>

        {!mfaStep ? (
          <>
            <p className="mb-6 text-muted">
              This system contains confidential personal and claims information and is for authorized Ulink Myanmar users only.
            </p>
            <form onSubmit={submit} className="grid gap-4">
              <label className="label">
                Email
                <input
                  className="input mt-1"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="label">
                <div className="flex justify-between items-center">
                  <span>Password</span>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetting}
                    className="text-xs text-brand font-normal hover:underline disabled:opacity-50"
                  >
                    {resetting ? 'Sending...' : 'Forgot password?'}
                  </button>
                </div>
                <input
                  className="input mt-1"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              {error && <p className="error">{error}</p>}
              {resetMessage && <p className="text-xs text-green-600">{resetMessage}</p>}

              <button className="btn justify-center" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Login'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-6 text-muted">
              Enter the 6-digit code from your authenticator app to complete sign-in.
            </p>
            <form onSubmit={submitCode} className="grid gap-4">
              <label className="label">
                Verification code
                <input
                  className="input mt-1"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn justify-center" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify & continue'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
