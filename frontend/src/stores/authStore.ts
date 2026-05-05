import { create } from 'zustand'
import api from '../api/client'

interface AuthUser {
  id: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    localStorage.setItem('wimm_token', res.data.access_token)
    const payload = JSON.parse(atob(res.data.access_token.split('.')[1]))
    set({ user: { id: payload.sub, email } })
  },

  register: async (email, password) => {
    const res = await api.post('/auth/register', { email, password })
    localStorage.setItem('wimm_token', res.data.access_token)
    const payload = JSON.parse(atob(res.data.access_token.split('.')[1]))
    set({ user: { id: payload.sub, email } })
  },

  logout: () => {
    localStorage.removeItem('wimm_token')
    set({ user: null })
  },

  hydrate: () => {
    const token = localStorage.getItem('wimm_token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        set({ user: { id: payload.sub, email: payload.email || '' }, loading: false })
      } catch {
        localStorage.removeItem('wimm_token')
        set({ loading: false })
      }
    } else {
      set({ loading: false })
    }
  },
}))
