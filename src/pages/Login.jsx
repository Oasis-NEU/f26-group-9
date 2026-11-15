import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { isNuEmail, requestCode, verifyCode } from '../services/auth'
import { useSession } from '../hooks/sessionContext'
import ErrorMessage from '../components/ErrorMessage'
import Spinner from '../components/Spinner'
import { safeNext } from '../lib/safeNext'

export default function Login() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { user, attendance, loading } = useSession()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (user) {
    if (loading) return <Spinner />
    return <Navigate to={attendance.length === 0 ? `/onboarding?next=${encodeURIComponent(next)}` : next} replace />
  }

  async function handleEmail(e) {
    e.preventDefault()
    setError(null)
    if (!isNuEmail(email)) return setError(new Error('Please use your @northeastern.edu email.'))
    setBusy(true)
    try {
      await requestCode(email)
      setStep('code')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleCode(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await verifyCode(email, code) // session change triggers the redirect above
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-md border border-gray-300 px-3 py-2 focus:border-red-700 focus:outline-none'
  const btn = 'w-full rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 disabled:opacity-50'

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-gray-600">
          Browsing is open to everyone. To write a review, sign in with your Northeastern email.
        </p>
      </div>
      {step === 'email' ? (
        <form onSubmit={handleEmail} className="space-y-3">
          <label className="block text-sm font-medium">
            Northeastern email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@northeastern.edu"
              className={`mt-1 ${input}`}
            />
          </label>
          <ErrorMessage error={error} />
          <button type="submit" disabled={busy} className={btn}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCode} className="space-y-3">
          <p className="text-sm text-gray-600">
            We sent a code to <strong>{email}</strong>.
          </p>
          <label className="block text-sm font-medium">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              maxLength={10}
              className={`mt-1 tracking-widest ${input}`}
            />
          </label>
          <ErrorMessage error={error} />
          <button type="submit" disabled={busy} className={btn}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <button type="button" onClick={() => setStep('email')} className="w-full text-sm text-gray-600 underline">
            Use a different email
          </button>
        </form>
      )}
    </div>
  )
}
