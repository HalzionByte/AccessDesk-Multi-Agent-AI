import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { api } from "../api/client"

const STORAGE_KEY = "accessdesk-session"

const AuthContext = createContext(null)

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && parsed.role ? parsed : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession)

  const login = useCallback((role, profile = null) => {
    const next = {
      role,
      profile,
      // Demo token. The real build exchanges a Firebase ID token here.
      token: `demo-${role}-token`,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    localStorage.setItem("accessdesk-token", next.token)
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem("accessdesk-token")
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      role: session?.role ?? null,
      profile: session?.profile ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.role),
      login,
      logout,
      api,
    }),
    [session, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside an AuthProvider")
  return context
}

export default AuthContext
