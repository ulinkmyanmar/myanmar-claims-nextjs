'use client'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase' // ✅ 替换为正确的导出

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient() // ✅ 调用实例
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateErr) {
        setError(updateErr.message)
      } else {
        setMessage('Password updated successfully! Redirecting to login...')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-white to-blue-50 p-6">
      <section className="card w-full max-w-md">
        <div className="mb-4 flex items-center gap-2 font-bold text-brand">
          <Lock /> Reset Your Password
        </div>
        <h1 className="mb-3 text-3xl font-bold leading-tight">Set New Password</h1>
        <p className="mb-6 text-muted">
          Enter your new password below to update your account credential.
        </p>

        <form onSubmit={handleUpdatePassword} className="grid gap-4">
          <label className="label">
            New Password
            <input
              className="input mt-1"
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>

          {error && <p className="error">{error}</p>}
          {message && <p className="text-xs text-green-600">{message}</p>}

          <button className="btn justify-center" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </section>
    </main>
  )
}
