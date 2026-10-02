import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { api } from "../api/client"
import { PageHeader } from "../components/shared"
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorBanner,
  Skeleton,
  StatusBadge,
  Textarea,
  Toast,
} from "../components/ui"

export default function CasesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [replies, setReplies] = useState({})
  const [sending, setSending] = useState("")
  const [toast, setToast] = useState("")
  const [openMenu, setOpenMenu] = useState("")
  const [viewCase, setViewCase] = useState(null)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      setItems(await api.getCases())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sendReply = (id) => {
    setSending(id)
    setTimeout(() => {
      setSending("")
      setReplies((current) => ({ ...current, [id]: "" }))
      setToast("Your reply was added to the case.")
    }, 500)
  }

  return (
    <>
      <PageHeader
        title="My cases"
        subtitle="Follow requests and reply when staff need more information."
      />
      {loading && (
        <div className="space-y-4">
          {[1, 2].map((item) => (
            <Card key={item}>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </Card>
          ))}
        </div>
      )}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="No cases yet"
          description="Start a request in Support."
          action={
            <Button onClick={() => navigate("/support")}>Go to Support</Button>
          }
        />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="relative">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-bold">{item.trackingNo}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                    Order {item.orderId}
                  </p>
                </div>
                <div className="relative flex items-center gap-2 self-start">
                  <StatusBadge status={item.status} />
                  <Button
                    variant="secondary"
                    square
                    className="size-11"
                    aria-label={`Options for ${item.trackingNo}`}
                    aria-haspopup="menu"
                    aria-expanded={openMenu === item.id}
                    onClick={() =>
                      setOpenMenu((current) =>
                        current === item.id ? "" : item.id,
                      )
                    }
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-6"
                      fill="currentColor"
                    >
                      <circle cx="5" cy="12" r="1.7" />
                      <circle cx="12" cy="12" r="1.7" />
                      <circle cx="19" cy="12" r="1.7" />
                    </svg>
                  </Button>
                  {openMenu === item.id && (
                    <div
                      role="menu"
                      className="absolute top-full right-0 z-10 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-stone-600 dark:bg-stone-700"
                    >
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        role="menuitem"
                        onClick={() => {
                          setViewCase(item)
                          setOpenMenu("")
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="size-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                        View details
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-5 border-t border-slate-200 pt-5 dark:border-stone-700">
                <p className="text-sm font-semibold">{item.issue}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-stone-400">
                  {item.summary}
                </p>
              </div>
              {item.status === "Needs Information" && (
                <div className="mt-5 rounded-lg bg-amber-50 p-4 dark:bg-amber-400/10">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Staff requested more information
                  </p>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                    {item.staffRequest}
                  </p>
                  <Textarea
                    className="mt-4 bg-white dark:bg-stone-800"
                    aria-label="Reply to staff"
                    placeholder="Write your reply…"
                    value={replies[item.id] || ""}
                    onChange={(event) =>
                      setReplies({ ...replies, [item.id]: event.target.value })
                    }
                  />
                  <Button
                    className="mt-3"
                    loading={sending === item.id}
                    disabled={!replies[item.id]?.trim()}
                    onClick={() => sendReply(item.id)}
                  >
                    Send reply
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={Boolean(viewCase)}
        title="Case details"
        description={viewCase?.trackingNo}
        onClose={() => setViewCase(null)}
        actions={
          <Button variant="secondary" onClick={() => setViewCase(null)}>
            Close
          </Button>
        }
      >
        {viewCase && (
          <dl className="divide-y divide-slate-200 text-sm dark:divide-stone-700">
            {[
              ["Status", <StatusBadge status={viewCase.status} />],
              ["Order", `${viewCase.orderId} · ${viewCase.product}`],
              ["Issue", viewCase.issue],
              ["Customer statement", viewCase.statement],
              ["Evidence", viewCase.evidence?.join(", ") || "No files"],
              ["Requested resolution", viewCase.resolution],
              ["Submitted", viewCase.submittedAt],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[9rem_1fr]"
              >
                <dt className="text-slate-500 dark:text-stone-400">{label}</dt>
                <dd className="font-medium text-slate-800 dark:text-stone-200">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Dialog>
      <Toast message={toast} onClose={() => setToast("")} />
    </>
  )
}
