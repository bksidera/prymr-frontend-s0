import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/auth.service'
import { authStore } from '../stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { token, user } = await authService.login(identifier.trim(), password)
      authStore.getState().login(token, user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
        <input
          autoFocus
          required
          type="text"
          placeholder="Email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:border-neutral-600 outline-none"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:border-neutral-600 outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-white text-black rounded-lg font-medium disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-sm text-neutral-400 text-center">
          No account?{' '}
          <Link to="/register" className="text-white underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  )
}
