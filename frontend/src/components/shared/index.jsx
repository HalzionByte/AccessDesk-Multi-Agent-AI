import { Button, Card } from "../ui"

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-600 dark:text-stone-400">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function CitationChip({ citation, onClick }) {
  return (
    <Button
      variant="secondary"
      square
      className="rounded-full px-2.5 py-1 text-xs"
      onClick={() => onClick(citation)}
    >
      {citation.id}
    </Button>
  )
}

export function ChatBubble({ role, children, citations = [], onCitation }) {
  const assistant = role === "assistant"
  return (
    <div className={`flex ${assistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-6 ${
          assistant
            ? "bg-slate-100 text-slate-800 dark:bg-stone-700 dark:text-stone-200"
            : "bg-indigo-600 text-white dark:bg-indigo-400 dark:text-stone-900"
        }`}
      >
        <p>{children}</p>
        {citations.length > 0 && (
          <div className="mt-2 flex gap-2">
            {citations.map((item) => (
              <CitationChip
                key={item.id}
                citation={item}
                onClick={onCitation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div
      aria-label="Assistant is typing"
      className="flex w-fit gap-1 rounded-xl bg-slate-100 px-4 py-3 dark:bg-stone-700"
    >
      {[0, 1, 2].map((item) => (
        <span
          key={item}
          className="size-1.5 rounded-full bg-slate-500 animate-[typing_1s_ease-in-out_infinite] dark:bg-stone-400"
          style={{ animationDelay: `${item * 140}ms` }}
        />
      ))}
    </div>
  )
}

export function Checklist({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-3 text-sm">
          <span
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
              item.done
                ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-stone-900"
                : "border-slate-300 text-slate-400 dark:border-stone-600 dark:text-stone-500"
            }`}
          >
            {item.done ? "✓" : ""}
          </span>
          <span
            className={
              item.done
                ? "text-slate-900 dark:text-stone-200"
                : "text-slate-600 dark:text-stone-400"
            }
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Timeline({ events = [], title = "Agent activity" }) {
  return (
    <Card>
      <p className="mb-4 font-semibold text-slate-900 dark:text-stone-100">
        {title}
      </p>
      <ol className="space-y-0">
        {events.map((event, index) => (
          <li
            key={`${event.action}-${index}`}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {index < events.length - 1 && (
              <span className="absolute left-1.5 top-4 h-full w-px bg-slate-200 dark:bg-stone-600" />
            )}
            <span className="relative mt-1.5 size-3 shrink-0 rounded-full border-2 border-indigo-600 bg-white dark:border-indigo-400 dark:bg-stone-800" />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-stone-200">
                {event.action}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-stone-400">
                {event.outcome}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
