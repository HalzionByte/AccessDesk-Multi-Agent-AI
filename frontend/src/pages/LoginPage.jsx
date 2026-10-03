import { useState } from "react"
import { useNavigate } from "react-router"
import { isMockMode } from "../api/client"
import { Button, Card, ErrorBanner, Input } from "../components/ui"
import { useAuth } from "../context/AuthContext"
export default function LoginPage() {
  const { demoLogin, login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ email: "", password: "" })
  const [lastRole, setLastRole] = useState(null)
  const signIn = async (demoRole = null) => {
    if (loading) return
    setLoading(true)
    setError("")
    setLastRole(demoRole)
    try {
      const session = demoRole
        ? await demoLogin(demoRole)
        : isMockMode
          ? await demoLogin("customer")
          : await login(form.email.trim(), form.password)
      navigate(session.role === "staff" ? "/staff" : "/support")
    } catch {
      setError(
        "We could not log you in. Check your credentials and configuration, then try again.",
      )
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="mx-auto flex max-w-md items-center py-8 sm:py-14">
      <Card className="w-full p-6 sm:p-8">
        <div className="mb-7 text-center">
          <p className="text-2xl font-bold tracking-tight">Welcome back</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-stone-400">
            Log in to manage your support requests.
          </p>
        </div>
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => signIn(lastRole)} />
          </div>
        )}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            signIn()
          }}
        >
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
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            placeholder="Enter your password"
          />
          <Button type="submit" loading={loading} className="w-full">
            Log in
          </Button>
        </form>
        {isMockMode && (
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
                onClick={() => signIn("customer")}
              >
                Log in as customer
              </Button>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => signIn("staff")}
              >
                Log in as staff
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
