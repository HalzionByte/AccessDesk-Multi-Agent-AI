import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router"
import { Button, Card, ErrorBanner, Input } from "../components/ui"
import { useAuth } from "../context/AuthContext"
import {
  authErrorMessage,
  isLoginLink,
  returnToFromLink,
  safeReturnTo,
  savedEmailForLink,
  validateEmail,
} from "../services/auth"

export default function FinishEmailLinkPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(savedEmailForLink)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const started = useRef(false)
  const returnTo = returnToFromLink(window.location.href)

  async function complete(address) {
    if (!validateEmail(address))
      return setError("Enter the email address that received this link.")
    setBusy(true)
    setError("")
    try {
      const session = await auth.completeEmailLinkSignIn(
        address,
        window.location.href,
      )
      if (session?.profile?.role)
        navigate(
          safeReturnTo(
            returnTo,
            session.profile.role === "staff" ? "/staff" : "/support",
          ),
          { replace: true },
        )
    } catch (failure) {
      setError(authErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    try {
      if (!started.current && email && isLoginLink()) {
        started.current = true
        complete(email)
      }
    } catch (failure) {
      setError(authErrorMessage(failure))
    }
  }, [])

  const validLink = (() => {
    try {
      return isLoginLink()
    } catch {
      return false
    }
  })()
  return (
    <div className="mx-auto max-w-md py-8 sm:py-14">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Finish signing in</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-stone-400">
          {validLink
            ? "Confirm the email address that received this link."
            : "This sign-in link is invalid or expired. Request a new link."}
        </p>
        {error && (
          <div className="mt-5">
            <ErrorBanner message={error} />
          </div>
        )}
        {validLink && (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              complete(email)
            }}
          >
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button
              type="submit"
              className="w-full"
              loading={busy}
              disabled={busy}
            >
              Complete sign in
            </Button>
          </form>
        )}
        <p className="mt-5 text-sm">
          <Link
            to="/login"
            className="font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
          >
            Request a new sign-in link
          </Link>
        </p>
      </Card>
    </div>
  )
}
