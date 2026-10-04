import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onIdTokenChanged,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth"
import { api, isMockMode, setAuthToken } from "../api/client"
import { getFirebaseAuth } from "../firebase"
import {
  authenticatedUserFrom,
  canSelfEnroll,
  customerName,
  isInvalidEmailLinkError,
} from "./authSession"

const DEMO_SESSION_KEY = "accessdesk-demo-session"
const EMAIL_LINK_STORAGE_KEY = "accessdesk-email-link"
const AuthContext = createContext(null)

function readJsonStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

function readDemoSession() {
  if (!isMockMode) return null
  const stored = readJsonStorage(DEMO_SESSION_KEY)
  return stored?.role ? stored : null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readDemoSession)
  const [initializing, setInitializing] = useState(!isMockMode)
  const [passwordlessLinkPending, setPasswordlessLinkPending] = useState(false)
  const [savedPasswordlessEmail, setSavedPasswordlessEmail] = useState("")
  const interactiveOperation = useRef(false)
  const sessionRevision = useRef(0)

  const resolveFirebaseSession = useCallback(
    async (
      firebaseUser,
      { allowEnrollment = false, registration = {} } = {},
    ) => {
      let token = await firebaseUser.getIdToken()
      let profile

      try {
        profile = await api.getMe(undefined, token)
      } catch (error) {
        if (!allowEnrollment || !canSelfEnroll(error)) throw error

        const name = customerName(firebaseUser, registration.name)
        if (!firebaseUser.displayName) {
          await updateProfile(firebaseUser, { displayName: name })
        }
        await api.registerCustomer(
          {
            name,
            preferredLanguage: registration.preferredLanguage || "en",
          },
          token,
        )
        token = await firebaseUser.getIdToken(true)
        profile = await api.getMe(undefined, token)
      }

      return { role: profile.role, profile, token }
    },
    [],
  )

  const commitFirebaseSession = useCallback(
    async (firebaseUser, options, revision) => {
      const next = await resolveFirebaseSession(firebaseUser, options)
      if (revision === sessionRevision.current) {
        setAuthToken(next.token)
        setSession(next)
      }
      return next
    },
    [resolveFirebaseSession],
  )

  const runFirebaseOperation = useCallback(
    async (authenticate, options = {}) => {
      const revision = ++sessionRevision.current
      interactiveOperation.current = true
      setSession(null)
      setAuthToken("")
      try {
        const firebaseUser = authenticatedUserFrom(await authenticate())
        return await commitFirebaseSession(firebaseUser, options, revision)
      } catch (error) {
        if (revision === sessionRevision.current) {
          setSession(null)
          setAuthToken("")
        }
        throw error
      } finally {
        interactiveOperation.current = false
        setInitializing(false)
      }
    },
    [commitFirebaseSession],
  )

  useEffect(() => {
    if (isMockMode) {
      const current = readDemoSession()
      setAuthToken(current?.token)
      setInitializing(false)
      return undefined
    }

    let active = true
    const unsubscribe = onIdTokenChanged(
      getFirebaseAuth(),
      async (firebaseUser) => {
        if (!active || interactiveOperation.current) return
        const revision = ++sessionRevision.current

        if (!firebaseUser) {
          setAuthToken("")
          setSession(null)
          setInitializing(false)
          return
        }

        try {
          await commitFirebaseSession(firebaseUser, {}, revision)
        } catch {
          if (active && revision === sessionRevision.current) {
            setSession(null)
            setAuthToken("")
          }
        } finally {
          if (active && revision === sessionRevision.current) {
            setInitializing(false)
          }
        }
      },
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [commitFirebaseSession])

  useEffect(() => {
    if (isMockMode) return
    try {
      const pending = isSignInWithEmailLink(
        getFirebaseAuth(),
        window.location.href,
      )
      setPasswordlessLinkPending(pending)
      if (pending) {
        setSavedPasswordlessEmail(
          readJsonStorage(EMAIL_LINK_STORAGE_KEY)?.email || "",
        )
      }
    } catch {
      setPasswordlessLinkPending(false)
    }
  }, [])

  const login = useCallback(
    async (email, password) => {
      if (isMockMode) return null
      const auth = getFirebaseAuth()
      return runFirebaseOperation(
        () => signInWithEmailAndPassword(auth, email.trim(), password),
        { allowEnrollment: true },
      )
    },
    [runFirebaseOperation],
  )

  const demoLogin = useCallback(async (role) => {
    if (!isMockMode) throw new Error("Demo login is disabled.")
    const profile = await api.getMe(role)
    const next = { role, profile, token: `demo-${role}-token` }
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next))
    setAuthToken(next.token)
    setSession(next)
    return next
  }, [])

  const loginWithGoogle = useCallback(
    async (registration = {}) => {
      if (isMockMode) return demoLogin("customer")
      const auth = getFirebaseAuth()
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: "select_account" })
      return runFirebaseOperation(() => signInWithPopup(auth, provider), {
        allowEnrollment: true,
        registration,
      })
    },
    [demoLogin, runFirebaseOperation],
  )

  const register = useCallback(
    async ({ name, email, password, preferredLanguage }) => {
      if (isMockMode) return demoLogin("customer")
      const auth = getFirebaseAuth()
      return runFirebaseOperation(
        async () => {
          const currentUser = auth.currentUser
          const credential =
            currentUser?.email === email
              ? await signInWithEmailAndPassword(auth, email, password)
              : await createUserWithEmailAndPassword(auth, email, password)
          const firebaseUser = authenticatedUserFrom(credential)
          await updateProfile(firebaseUser, { displayName: name })
          return credential
        },
        {
          allowEnrollment: true,
          registration: { name, preferredLanguage },
        },
      )
    },
    [demoLogin, runFirebaseOperation],
  )

  const sendPasswordlessLink = useCallback(async (registration) => {
    if (isMockMode)
      throw new Error("Passwordless login is disabled in mock mode.")
    const email = registration.email.trim()
    await sendSignInLinkToEmail(getFirebaseAuth(), email, {
      url: new URL("/login", window.location.origin).toString(),
      handleCodeInApp: true,
    })
    localStorage.setItem(
      EMAIL_LINK_STORAGE_KEY,
      JSON.stringify({
        email,
        name: registration.name?.trim() || "",
        preferredLanguage: registration.preferredLanguage || "en",
      }),
    )
    setSavedPasswordlessEmail(email)
  }, [])

  const completePasswordlessLogin = useCallback(
    async (email) => {
      if (isMockMode)
        throw new Error("Passwordless login is disabled in mock mode.")
      const auth = getFirebaseAuth()
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        const error = new Error(
          "This email sign-in link is invalid or expired.",
        )
        error.code = "auth/invalid-action-code"
        localStorage.removeItem(EMAIL_LINK_STORAGE_KEY)
        setPasswordlessLinkPending(false)
        setSavedPasswordlessEmail("")
        window.history.replaceState({}, "", "/login")
        throw error
      }
      const registration = readJsonStorage(EMAIL_LINK_STORAGE_KEY) || {}
      try {
        const result = await runFirebaseOperation(
          () => signInWithEmailLink(auth, email.trim(), window.location.href),
          { allowEnrollment: true, registration },
        )
        localStorage.removeItem(EMAIL_LINK_STORAGE_KEY)
        setPasswordlessLinkPending(false)
        setSavedPasswordlessEmail("")
        return result
      } catch (error) {
        if (isInvalidEmailLinkError(error)) {
          localStorage.removeItem(EMAIL_LINK_STORAGE_KEY)
          setPasswordlessLinkPending(false)
          setSavedPasswordlessEmail("")
          window.history.replaceState({}, "", "/login")
        }
        throw error
      }
    },
    [runFirebaseOperation],
  )

  const logout = useCallback(async () => {
    ++sessionRevision.current
    interactiveOperation.current = true
    try {
      if (isMockMode) localStorage.removeItem(DEMO_SESSION_KEY)
      else await signOut(getFirebaseAuth())
    } finally {
      interactiveOperation.current = false
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
      loginWithGoogle,
      sendPasswordlessLink,
      completePasswordlessLogin,
      passwordlessLinkPending,
      savedPasswordlessEmail,
      register,
      demoLogin,
      logout,
    }),
    [
      session,
      initializing,
      login,
      loginWithGoogle,
      sendPasswordlessLink,
      completePasswordlessLogin,
      passwordlessLinkPending,
      savedPasswordlessEmail,
      register,
      demoLogin,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside an AuthProvider")
  return context
}

export default AuthContext
