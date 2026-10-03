import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth"
import { api, isMockMode, setAuthToken } from "../api/client"
import { getFirebaseAuth } from "../firebase"
const STORAGE_KEY = "accessdesk-demo-session"
const AuthContext = createContext(null)
function readDemoSession() {
  if (!isMockMode) return null
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return parsed?.role ? parsed : null
  } catch {
    return null
  }
}
export function AuthProvider({ children }) {
  const [session, setSession] = useState(readDemoSession)
  const [initializing, setInitializing] = useState(!isMockMode)
  const establishFirebaseSession = useCallback(async (firebaseUser) => {
    const token = await firebaseUser.getIdToken()
    setAuthToken(token)
    const profile = await api.getMe()
    const next = { role: profile.role, profile, token }
    setSession(next)
    return next
  }, [])
  useEffect(() => {
    if (isMockMode) {
      const current = readDemoSession()
      setAuthToken(current?.token)
      return undefined
    }
    let unsubscribe = () => {}
    try {
      unsubscribe = onIdTokenChanged(
        getFirebaseAuth(),
        async (firebaseUser) => {
          try {
            if (firebaseUser) await establishFirebaseSession(firebaseUser)
            else {
              setAuthToken("")
              setSession(null)
            }
          } catch {
            setAuthToken("")
            setSession(null)
          } finally {
            setInitializing(false)
          }
        },
      )
    } catch {
      setInitializing(false)
    }
    return unsubscribe
  }, [establishFirebaseSession])
  const login = useCallback(
    async (email, password) => {
      if (isMockMode) return null
      const credential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password,
      )
      return establishFirebaseSession(credential.user)
    },
    [establishFirebaseSession],
  )
  const demoLogin = useCallback(async (role) => {
    if (!isMockMode) throw new Error("Demo login is disabled.")
    const profile = await api.getMe(role)
    const next = { role, profile, token: `demo-${role}-token` }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setAuthToken(next.token)
    setSession(next)
    return next
  }, [])
  const logout = useCallback(async () => {
    try {
      if (isMockMode) localStorage.removeItem(STORAGE_KEY)
      else await signOut(getFirebaseAuth())
    } catch {
      // Local session data must still be cleared if Firebase is unreachable.
    } finally {
      setAuthToken("")
      setSession(null)
    }
  }, [])
  const value = useMemo(
    () => ({
      role: session?.role ?? null,
      profile: session?.profile ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.role),
      initializing,
      login,
      demoLogin,
      logout,
    }),
    [session, initializing, login, demoLogin, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside an AuthProvider")
  return context
}
export default AuthContext
