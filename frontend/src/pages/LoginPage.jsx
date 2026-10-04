import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { isMockMode } from "../api/client"
import {
  Button,
  Card,
  ErrorBanner,
  Input,
  Select,
  Spinner,
} from "../components/ui"
import { useAuth } from "../context/AuthContext"
import {
  authenticationErrorMessage,
  validatePasswordlessRegistration,
  validateRegistration,
} from "./authForm"
export default function LoginPage() {
  const {
    completePasswordlessLogin,
    demoLogin,
    initializing,
    isAuthenticated,
    login,
    loginWithGoogle,
    passwordlessLinkPending,
    register,
    role,
    savedPasswordlessEmail,
    sendPasswordlessLink,
  } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState("login")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    preferredLanguage: "en",
  })
  const [lastRole, setLastRole] = useState(null)
  const [retryAction, setRetryAction] = useState(null)
  const finishEmailLink = useCallback(
    async (email) => {
      if (!email.trim()) {
        setError("Enter the email address that received this sign-in link.")
        return
      }
      setLoading(true)
      setError("")
      setRetryAction("email-link-complete")
      try {
        const session = await completePasswordlessLogin(email)
        navigate(session.role === "staff" ? "/staff" : "/support")
      } catch (requestError) {
        if (
          requestError?.code === "auth/invalid-action-code" ||
          requestError?.code === "auth/expired-action-code"
        ) {
          setRetryAction("email-link-request")
        }
        setError(authenticationErrorMessage(requestError, "login"))
      } finally {
        setLoading(false)
      }
    },
    [completePasswordlessLogin, navigate],
  )
  const authenticate = async (demoRole = null) => {
    if (loading || initializing) return
    if (passwordlessLinkPending) {
      await finishEmailLink(form.email)
      return
    }
    if (mode === "register" && !demoRole) {
      const validationError = validateRegistration(form)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    setLoading(true)
    setError("")
    setLastRole(demoRole)
    setRetryAction("form")
    try {
      const session = demoRole
        ? await demoLogin(demoRole)
        : mode === "register"
          ? await register({
              name: form.name.trim(),
              email: form.email.trim(),
              password: form.password,
              preferredLanguage: form.preferredLanguage,
            })
          : isMockMode
            ? await demoLogin("customer")
            : await login(form.email.trim(), form.password)
      navigate(session.role === "staff" ? "/staff" : "/support")
    } catch (requestError) {
      setError(authenticationErrorMessage(requestError, mode))
    } finally {
      setLoading(false)
    }
  }
  const authenticateWithGoogle = async () => {
    if (loading || initializing) return
    setLoading(true)
    setError("")
    setNotice("")
    setRetryAction("google")
    try {
      const session = await loginWithGoogle({
        name: mode === "register" ? form.name.trim() : "",
        preferredLanguage: form.preferredLanguage,
      })
      navigate(session.role === "staff" ? "/staff" : "/support")
    } catch (requestError) {
      setError(authenticationErrorMessage(requestError, mode))
    } finally {
      setLoading(false)
    }
  }
  const requestPasswordlessLink = async () => {
    if (loading || initializing) return
    const email = form.email.trim()
    const validationError =
      mode === "register"
        ? validatePasswordlessRegistration({ name: form.name, email })
        : !email
          ? "Enter your email address."
          : ""
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    setError("")
    setNotice("")
    setRetryAction("email-link-request")
    try {
      await sendPasswordlessLink({
        email,
        name: mode === "register" ? form.name : "",
        preferredLanguage: form.preferredLanguage,
      })
      setNotice(`We sent a secure sign-in link to ${email}.`)
    } catch (requestError) {
      setError(authenticationErrorMessage(requestError, mode))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initializing && isAuthenticated)
      navigate(role === "staff" ? "/staff" : "/support", { replace: true })
  }, [initializing, isAuthenticated, navigate, role])

  useEffect(() => {
    if (!passwordlessLinkPending || !savedPasswordlessEmail) return
    setForm((current) => ({ ...current, email: savedPasswordlessEmail }))
  }, [passwordlessLinkPending, savedPasswordlessEmail])

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setError("")
    setNotice("")
    setLastRole(null)
    setRetryAction(null)
    setForm((current) => ({
      ...current,
      password: "",
      confirmPassword: "",
    }))
  }

  const retryLastAction = () => {
    if (retryAction === "google") return authenticateWithGoogle()
    if (retryAction === "email-link-request") return requestPasswordlessLink()
    if (retryAction === "email-link-complete")
      return finishEmailLink(form.email)
    return authenticate(lastRole)
  }

  if (initializing) {
    return (
      <div className="flex min-h-48 items-center justify-center" role="status">
        <Spinner className="size-6" />
        <span className="sr-only">Checking your sign-in session</span>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md items-center py-8 sm:py-14">
      <Card className="w-full p-6 sm:p-8">
        <div className="mb-7 text-center">
          <p className="text-2xl font-bold tracking-tight">
            {passwordlessLinkPending
              ? "Finish signing in"
              : mode === "login"
                ? "Welcome back"
                : "Create your account"}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-stone-400">
            {passwordlessLinkPending
              ? "Confirm the email address that received this secure link."
              : mode === "login"
                ? "Log in to manage your support requests."
                : "Sign up as a customer to start and track support requests."}
          </p>
        </div>
        {!passwordlessLinkPending && (
          <div
            className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 dark:bg-stone-900"
            aria-label="Authentication mode"
          >
            <Button
              variant={mode === "login" ? "primary" : "ghost"}
              className="w-full"
              aria-pressed={mode === "login"}
              onClick={() => changeMode("login")}
            >
              Log in
            </Button>
            <Button
              variant={mode === "register" ? "primary" : "ghost"}
              className="w-full"
              aria-pressed={mode === "register"}
              onClick={() => changeMode("register")}
            >
              Create account
            </Button>
          </div>
        )}
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={retryLastAction} />
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
          >
            {notice}
          </div>
        )}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            authenticate()
          }}
        >
          {mode === "register" && !passwordlessLinkPending && (
            <Input
              label="Full name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="Your full name"
            />
          )}
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            placeholder="you@example.com"
          />
          {!passwordlessLinkPending && (
            <Input
              label="Password"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "register" ? 8 : undefined}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="Enter your password"
            />
          )}
          {mode === "register" && !passwordlessLinkPending && (
            <>
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm({ ...form, confirmPassword: event.target.value })
                }
                placeholder="Enter the password again"
              />
              <Select
                label="Preferred language"
                value={form.preferredLanguage}
                onChange={(event) =>
                  setForm({ ...form, preferredLanguage: event.target.value })
                }
              >
                <option value="en">English</option>
                <option value="roman-urdu">Roman Urdu</option>
              </Select>
            </>
          )}
          <Button type="submit" loading={loading} className="w-full">
            {passwordlessLinkPending
              ? "Complete email sign-in"
              : mode === "login"
                ? "Log in"
                : "Create customer account"}
          </Button>
        </form>
        {!isMockMode && !passwordlessLinkPending && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-400 dark:text-stone-500">
              <span className="h-px flex-1 bg-slate-200 dark:bg-stone-600" />
              Or continue without a password
              <span className="h-px flex-1 bg-slate-200 dark:bg-stone-600" />
            </div>
            <div className="grid gap-3">
              <Button
                variant="secondary"
                className="w-full"
                disabled={loading}
                onClick={authenticateWithGoogle}
              >
                <span aria-hidden="true" className="font-bold text-blue-600">
                  G
                </span>
                Continue with Google
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                disabled={loading}
                onClick={requestPasswordlessLink}
              >
                <span aria-hidden="true">✉</span>
                Email me a sign-in link
              </Button>
            </div>
          </>
        )}
        {isMockMode && mode === "login" && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-400 dark:text-stone-500">
              <span className="h-px flex-1 bg-slate-200 dark:bg-stone-600" />
              Demo access
              <span className="h-px flex-1 bg-slate-200 dark:bg-stone-600" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => authenticate("customer")}
              >
                Log in as customer
              </Button>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => authenticate("staff")}
              >
                Log in as staff
              </Button>
            </div>
          </>
        )}
        {mode === "register" && !passwordlessLinkPending && (
          <p className="mt-5 text-center text-xs text-slate-500 dark:text-stone-400">
            New accounts are customers. Staff access is created by an
            administrator.
          </p>
        )}
      </Card>
    </div>
  )
}
