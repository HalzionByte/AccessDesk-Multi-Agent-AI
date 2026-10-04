import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { Button, Card, ErrorBanner, Input } from "../components/ui"
import { useAuth } from "../context/AuthContext"
import {
  authErrorMessage,
  safeReturnTo,
  validateEmail,
  validatePassword,
} from "../services/auth"

export default function LoginPage({ mode = "signin" }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const returnTo = params.get("returnTo")
  const otherPath = `${mode === "signup" ? "/login" : "/signup"}${location.search}`
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [resetOpen, setResetOpen] = useState(false)

  async function perform(operation) {
    if (busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      return await operation()
    } catch (failure) {
      setError(authErrorMessage(failure))
      return null
    } finally {
      setBusy(false)
    }
  }

  function destination(session) {
    if (!session?.profile?.role) return
    navigate(
      safeReturnTo(
        returnTo,
        session.profile.role === "staff" ? "/staff" : "/support",
      ),
      { replace: true },
    )
  }

  async function submit(event) {
    event.preventDefault()
    if (!validateEmail(form.email))
      return setError("Enter a valid email address.")
    if (resetOpen) {
      await perform(async () => {
        await auth.resetPassword(form.email)
        setNotice(
          "If this email has an account, password reset instructions have been sent.",
        )
      })
      return
    }
    if (mode === "signup") {
      if (form.name.trim().length < 2)
        return setError("Enter your full name (at least 2 characters).")
      if (!validatePassword(form.password))
        return setError("Use a password with at least 8 characters.")
      if (form.password !== form.confirmPassword)
        return setError("The passwords do not match.")
      await perform(async () => {
        await auth.signUpWithEmail({
          name: form.name,
          email: form.email,
          password: form.password,
        })
        setNotice("Account created. Check your inbox for a verification email.")
      })
      return
    }
    if (!validatePassword(form.password))
      return setError("Enter your password (at least 8 characters).")
    const session = await perform(() =>
      auth.signInWithEmail(form.email, form.password),
    )
    destination(session)
  }

  async function useGoogle() {
    const session = await perform(() => auth.signInWithGoogle(returnTo))
    destination(session)
  }

  async function useEmailLink() {
    if (!validateEmail(form.email))
      return setError("Enter a valid email address first.")
    if (mode === "signup" && form.name.trim().length < 2)
      return setError("Enter your full name (at least 2 characters).")
    await perform(async () => {
      await auth.sendLoginLink(
        form.email,
        safeReturnTo(returnTo),
        mode === "signup" ? form.name : "",
      )
      setNotice(
        `A sign-in link has been sent to ${form.email.trim()}. Open it in this browser or enter your email on the linked page.`,
      )
    })
  }

  if (auth.user && !auth.user.emailVerified) {
    return (
      <div className="mx-auto max-w-md py-8 sm:py-14">
        <Card className="space-y-4 p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Verify your email</h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-stone-300">
            We sent a verification link to {auth.user.email}. Open it, then
            return here and select “I verified my email”.
          </p>
          {(error || auth.error) && (
            <ErrorBanner message={error || auth.error} />
          )}
          {notice && (
            <p
              role="status"
              className="text-sm text-emerald-700 dark:text-emerald-300"
            >
              {notice}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy}
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  const session = await auth.refreshSession()
                  if (session) destination(session)
                  else
                    setNotice(
                      "This email is not verified yet. Check your inbox and try again.",
                    )
                })
              }
            >
              I verified my email
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await auth.resendVerification()
                  setNotice("A new verification email has been sent.")
                })
              }
            >
              Resend email
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => perform(() => auth.logout())}
            >
              Use another account
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const setupPending = auth.user && !auth.role

  return (
    <div className="mx-auto max-w-md py-8 sm:py-14">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {resetOpen
            ? "Reset your password"
            : mode === "signup"
              ? "Create your account"
              : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-stone-400">
          {resetOpen
            ? "We'll email you a reset link."
            : mode === "signup"
              ? "Start and track your support requests."
              : "Sign in to manage your support requests."}
        </p>
        {(error || auth.error) && (
          <div className="mt-5">
            <ErrorBanner message={error || auth.error} />
          </div>
        )}
        {setupPending && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => perform(() => auth.refreshSession())}
            >
              Retry account setup
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => perform(() => auth.logout())}
            >
              Sign out
            </Button>
          </div>
        )}
        {notice && (
          <p
            role="status"
            className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"
          >
            {notice}
          </p>
        )}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === "signup" && !resetOpen && (
            <Input
              label="Full name"
              autoComplete="name"
              maxLength={100}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          )}
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            required
          />
          {!resetOpen && (
            <Input
              label="Password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              required
              minLength={8}
            />
          )}
          {mode === "signup" && !resetOpen && (
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) =>
                setForm({ ...form, confirmPassword: event.target.value })
              }
              required
              minLength={8}
            />
          )}
          <Button
            type="submit"
            className="w-full"
            loading={busy}
            disabled={busy}
          >
            {resetOpen
              ? "Send reset email"
              : mode === "signup"
                ? "Sign up"
                : "Sign in"}
          </Button>
        </form>
        {!resetOpen && (
          <div className="mt-4 grid gap-2">
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={useGoogle}
            >
              {mode === "signup"
                ? "Sign up with Google"
                : "Sign in with Google"}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={useEmailLink}
            >
              {mode === "signup"
                ? "Send me a sign-in link"
                : "Email me a sign-in link"}
            </Button>
          </div>
        )}
        {mode === "signin" && (
          <Button
            variant="ghost"
            className="mt-3 w-full"
            disabled={busy}
            onClick={() => {
              setResetOpen(!resetOpen)
              setError("")
              setNotice("")
            }}
          >
            {resetOpen ? "Back to sign in" : "Forgot password?"}
          </Button>
        )}
        {!resetOpen && (
          <p className="mt-5 text-center text-sm text-slate-600 dark:text-stone-400">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <Link
              className="font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
              to={otherPath}
            >
              {mode === "signup" ? "Sign in" : "Sign up"}
            </Link>
          </p>
        )}
      </Card>
    </div>
  )
}
