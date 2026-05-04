import { useState, useEffect } from 'react'
import api from '../api/client'

interface AuthUser {
  id: string
  email: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('wimm_token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUser({ id: payload.sub, email: payload.email || '' })
      } catch {
        localStorage.removeItem('wimm_token')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    localStorage.setItem('wimm_token', res.data.access_token)
    const payload = JSON.parse(atob(res.data.access_token.split('.')[1]))
    setUser({ id: payload.sub, email })
  }

  const register = async (email: string, password: string) => {
    const res = await api.post('/auth/register', { email, password })
    localStorage.setItem('wimm_token', res.data.access_token)
    const payload = JSON.parse(atob(res.data.access_token.split('.')[1]))
    setUser({ id: payload.sub, email })
  }

  const logout = () => {
    localStorage.removeItem('wimm_token')
    setUser(null)
  }

  return { user, loading, login, register, logout }
}
