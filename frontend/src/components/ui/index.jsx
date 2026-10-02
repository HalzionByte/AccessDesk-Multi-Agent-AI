import { forwardRef, useEffect } from "react"

export function Spinner({ className = "" }) {
  return (
    <span
      aria-label="Loading"
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  )
}

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}) {
  const styles = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-stone-900 dark:hover:bg-indigo-300",
    secondary:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-400 dark:text-stone-900 dark:hover:bg-rose-300",
    ghost:
      "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-100",
  }
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-stone-900 ${styles[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Card({ children, className = "", ...props }) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:shadow-none ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}

const statusStyles = {
  Draft: "bg-slate-100 text-slate-700 dark:bg-stone-500/15 dark:text-stone-300",
  Submitted: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  "Under Review":
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
  "Needs Information":
    "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  Approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  Declined: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  Closed: "bg-gray-100 text-gray-700 dark:bg-stone-500/15 dark:text-stone-300",
}

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status] || statusStyles.Draft}`}
    >
      {status}
    </span>
  )
}

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/25"

export const Input = forwardRef(function Input(
  { label, error, className = "", containerClassName = "", ...props },
  ref,
) {
  return (
    <label
      className={`block text-sm font-medium text-slate-700 dark:text-stone-300 ${containerClassName}`}
    >
      {label && <span className="mb-1.5 block">{label}</span>}
      <input ref={ref} className={`${fieldClass} ${className}`} {...props} />
      {error && (
        <span className="mt-1.5 block text-xs text-rose-600 dark:text-rose-300">
          {error}
        </span>
      )}
    </label>
  )
})

export function Select({ label, children, className = "", ...props }) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-stone-300">
      {label && <span className="mb-1.5 block">{label}</span>}
      <select className={`${fieldClass} ${className}`} {...props}>
        {children}
      </select>
    </label>
  )
}

export function Textarea({ label, className = "", ...props }) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-stone-300">
      {label && <span className="mb-1.5 block">{label}</span>}
      <textarea
        className={`${fieldClass} min-h-24 resize-y ${className}`}
        {...props}
      />
    </label>
  )
}

export function Skeleton({ className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-200 dark:bg-stone-700 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-stone-500/25" />
    </div>
  )
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200"
    >
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-stone-600">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-stone-700 dark:text-stone-300">
        —
      </div>
      <p className="font-semibold text-slate-900 dark:text-stone-100">
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-stone-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onClose, 4500)
    return () => clearTimeout(timer)
  }, [message, onClose])
  if (!message) return null
  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-lg dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100"
    >
      <div className="flex items-start justify-between gap-4">
        <span>{message}</span>
        <Button
          variant="ghost"
          className="min-h-0 px-1 py-0"
          onClick={onClose}
          aria-label="Dismiss"
        >
          ×
        </Button>
      </div>
    </div>
  )
}

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  actions,
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 dark:bg-stone-950/70"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-description" : undefined}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-stone-700 dark:bg-stone-800 dark:shadow-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              id="dialog-title"
              className="text-lg font-semibold text-slate-900 dark:text-stone-100"
            >
              {title}
            </p>
            {description && (
              <p
                id="dialog-description"
                className="mt-1 text-sm text-slate-600 dark:text-stone-400"
              >
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            className="size-9 min-h-0 shrink-0 px-0 py-0"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Button>
        </div>
        {children && <div className="mt-5">{children}</div>}
        {actions && (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {actions}
          </div>
        )}
      </section>
    </div>
  )
}
