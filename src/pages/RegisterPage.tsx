import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/auth.service'
import { authStore } from '../stores/authStore'

export function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { token, user } = await authService.register({
        email: email.trim(),
        userName: userName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      })
      authStore.getState().login(token, user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-medium tracking-tight mb-2">Create account</h1>
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:border-neutral-600 outline-none"
        />
        <input
          required
          type="text"
          placeholder="Username"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:border-neutral-600 outline-none"
        />
        <div className="flex gap-3">
          <input
            required
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-1/2 px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:border-neutral-600 outline-none"
          />
          <input
            required
            type="text"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-1/2 px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg focus:border-neutral-600 outline-none"
          />
        </div>
        <input
          required
          minLength={6}
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
          {submitting ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-sm text-neutral-400 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-white underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
