import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { onAuthStateChanged, onIdTokenChanged } from "firebase/auth"
import { api, isMockMode, setAuthToken } from "../api/client"
import { getFirebaseAuth } from "../firebase"
import * as authService from "../services/auth"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [token, setToken] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState("")
  const [redirectReturnTo, setRedirectReturnTo] = useState(null)
  const [redirectChecked, setRedirectChecked] = useState(false)
  const revision = useRef(0)
  const inflight = useRef(null)
  const authenticatedUid = useRef(null)

  const clearSession = useCallback(() => {
    authenticatedUid.current = null
    setAuthToken("")
    setProfile(null)
    setToken(null)
  }, [])

  const resolveSession = useCallback(
    async (firebaseUser) => {
      if (!firebaseUser) return null
      if (!firebaseUser.emailVerified) {
        clearSession()
        setUser(firebaseUser)
        setInitializing(false)
        return null
      }
      if (inflight.current?.uid === firebaseUser.uid)
        return inflight.current.promise
      const currentRevision = ++revision.current
      setInitializing(true)
      const promise = (async () => {
        await authService.syncUserDocument(firebaseUser)
        let idToken = await firebaseUser.getIdToken()
        let backendProfile
        try {
          const mockRole = isMockMode
            ? (await firebaseUser.getIdTokenResult()).claims.role
            : undefined
          backendProfile = await api.getMe(mockRole, idToken)
        } catch (requestError) {
          if (
            requestError.status !== 403 ||
            requestError.code !== "role_required"
          )
            throw requestError
          await api.registerCustomer(
            {
              name:
                firebaseUser.displayName || firebaseUser.email.split("@")[0],
              preferredLanguage: "en",
            },
            idToken,
          )
          idToken = await firebaseUser.getIdToken(true)
          backendProfile = await api.getMe(undefined, idToken)
        }
        if (currentRevision === revision.current) {
          authenticatedUid.current = firebaseUser.uid
          setUser(firebaseUser)
          setProfile(backendProfile)
          setToken(idToken)
          setAuthToken(idToken)
          setError("")
        }
        return { user: firebaseUser, profile: backendProfile, token: idToken }
      })()
      inflight.current = { uid: firebaseUser.uid, promise }
      try {
        return await promise
      } catch (sessionError) {
        if (currentRevision === revision.current) {
          clearSession()
          setUser(firebaseUser)
          setError(authService.authErrorMessage(sessionError))
        }
        throw sessionError
      } finally {
        if (inflight.current?.promise === promise) inflight.current = null
        if (currentRevision === revision.current) setInitializing(false)
      }
    },
    [clearSession],
  )

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    let unsubscribeToken = () => {}
    try {
      const auth = getFirebaseAuth()
      unsubscribe = onAuthStateChanged(
        auth,
        (nextUser) => {
          if (!active) return
          if (!nextUser) {
            ++revision.current
            inflight.current = null
            clearSession()
            setUser(null)
            setInitializing(false)
            return
          }
          setUser(nextUser)
          resolveSession(nextUser).catch(() => {})
        },
        (authError) => {
          if (!active) return
          setError(authService.authErrorMessage(authError))
          setInitializing(false)
        },
      )
      unsubscribeToken = onIdTokenChanged(auth, async (tokenUser) => {
        if (!active || !tokenUser || authenticatedUid.current !== tokenUser.uid)
          return
        try {
          const freshToken = await tokenUser.getIdToken()
          if (active && authenticatedUid.current === tokenUser.uid) {
            setAuthToken(freshToken)
            setToken(freshToken)
          }
        } catch (tokenError) {
          if (active) setError(authService.authErrorMessage(tokenError))
        }
      })
      authService
        .finishGoogleRedirect()
        .then(async (result) => {
          if (active && result) {
            setRedirectReturnTo(result.returnTo)
            setUser(result.user)
            await resolveSession(result.user)
          }
        })
        .catch((redirectError) => {
          if (active) setError(authService.authErrorMessage(redirectError))
        })
        .finally(() => {
          if (active) setRedirectChecked(true)
        })
    } catch (configError) {
      setError(configError.message)
      setInitializing(false)
      setRedirectChecked(true)
    }
    return () => {
      active = false
      unsubscribe()
      unsubscribeToken()
      ++revision.current
    }
  }, [clearSession, resolveSession])

  const complete = useCallback(
    async (operation) => {
      setError("")
      const nextUser = await operation()
      return nextUser ? resolveSession(nextUser) : null
    },
    [resolveSession],
  )

  const signUpWithEmail = useCallback(async (values) => {
    setError("")
    const nextUser = await authService.signUpWithEmail(values)
    setUser(nextUser)
    return nextUser
  }, [])

  const refreshSession = useCallback(async () => {
    const freshUser = await authService.refreshUser(
      getFirebaseAuth().currentUser,
    )
    setUser(freshUser)
    return resolveSession(freshUser)
  }, [resolveSession])

  const logout = useCallback(async () => {
    ++revision.current
    inflight.current = null
    await authService.logout()
    clearSession()
    setUser(null)
    setError("")
  }, [clearSession])

  const value = useMemo(
    () => ({
      user,
      profile,
      token,
      role: profile?.role || null,
      isAuthenticated: Boolean(profile?.role),
      initializing,
      error,
      redirectReturnTo,
      redirectChecked,
      clearRedirectReturnTo: () => setRedirectReturnTo(null),
      signUpWithEmail,
      signInWithEmail: (email, password) =>
        complete(() => authService.signInWithEmail(email, password)),
      signInWithGoogle: (returnTo) =>
        complete(() => authService.signInWithGoogle(returnTo)),
      completeEmailLinkSignIn: (email, url) =>
        complete(() => authService.completeEmailLinkSignIn(email, url)),
      sendLoginLink: authService.sendLoginLink,
      resetPassword: authService.resetPassword,
      resendVerification: () =>
        authService.resendVerification(getFirebaseAuth().currentUser),
      refreshSession,
      logout,
    }),
    [
      user,
      profile,
      token,
      initializing,
      error,
      redirectReturnTo,
      redirectChecked,
      signUpWithEmail,
      complete,
      refreshSession,
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
