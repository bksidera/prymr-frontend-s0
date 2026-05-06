import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { authService } from '../services/auth.service'
import { authStore, useAuth } from '../stores/authStore'

function randomPassword(): string {
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function useGuestAuth() {
  const { isAuthenticated } = useAuth()
  const [ready, setReady] = useState(isAuthenticated)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      setReady(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const handle = `guest_${uuidv4().slice(0, 8)}`
        const password = randomPassword()
        const { token, user } = await authService.register({
          email: `${handle}@prymr.local`,
          userName: handle,
          firstName: 'Guest',
          lastName: handle.slice(6),
          password,
        })
        if (!cancelled) {
          authStore.getState().login(token, user)
          setReady(true)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Guest auth failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  return { ready, error }
}
