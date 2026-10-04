import { Link } from "react-router"
import { useAuth } from "../context/AuthContext"

const features = [
  {
    icon: "01",
    title: "Speak naturally",
    text: "Describe the problem in English or Roman Urdu. The assistant turns the conversation into clear support details.",
  },
  {
    icon: "02",
    title: "Know what is needed",
    text: "A friendly checklist shows missing information, photo evidence, and the relevant fictional policy citations.",
  },
  {
    icon: "03",
    title: "Stay in control",
    text: "Review the complete request before submitting and follow every update with one tracking number.",
  },
]

const steps = [
  [
    "Tell us what happened",
    "Choose an order and explain the issue in your own words.",
  ],
  [
    "Complete the request",
    "Add any missing details and a clear photo of the damaged item.",
  ],
  [
    "Review and track",
    "Confirm the preview, receive a tracking number, and follow staff updates.",
  ],
]

export default function HomePage() {
  const { role } = useAuth()
  const primaryPath =
    role === "staff" ? "/staff" : role === "customer" ? "/support" : "/login"
  const primaryLabel = role ? "Open your workspace" : "Get started"

  return (
    <div className="space-y-20 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-amber-50 px-6 py-14 sm:px-10 sm:py-20 lg:px-16 dark:border-indigo-400/20 dark:from-indigo-950/60 dark:via-stone-900 dark:to-amber-950/30">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/15" />
        <div className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-500/10" />
        <div className="relative max-w-3xl">
          <p className="mb-5 inline-flex rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:border-indigo-400/30 dark:bg-stone-900/70 dark:text-indigo-300">
            Calm, clear customer support
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl dark:text-white">
            Turn a frustrating delivery into a clear next step.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-stone-300">
            AccessDesk helps customers report damaged products, understand what
            information is needed, and track support requests without repeating
            the whole story.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to={primaryPath}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-indigo-400 dark:text-stone-950 dark:hover:bg-indigo-300"
            >
              {primaryLabel}
            </Link>
            <Link
              to="/about"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-stone-600 dark:bg-stone-800/80 dark:text-stone-100 dark:hover:bg-stone-700"
            >
              How AccessDesk works
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600 dark:text-stone-400">
            <span>✓ English and Roman Urdu</span>
            <span>✓ Review before submission</span>
            <span>✓ Human staff decisions</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            Support without the guesswork
          </p>
          <h2
            id="features-title"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
          >
            A friendlier way to ask for help
          </h2>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-800"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300">
                {feature.icon}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-stone-400">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-10 rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:px-12 lg:py-14 dark:bg-stone-800">
        <div>
          <p className="text-sm font-semibold text-indigo-300">
            Three simple steps
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            From complaint to trackable request
          </h2>
          <p className="mt-4 leading-7 text-slate-300 dark:text-stone-300">
            The assistant handles the conversation. Trusted backend rules handle
            identity, evidence, confirmation, and duplicate prevention.
          </p>
        </div>
        <ol className="space-y-5">
          {steps.map(([title, text], index) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-400 font-bold text-slate-950">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300 dark:text-stone-300">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Ready when you are
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-stone-400">
          Create a customer account, choose your order, and let AccessDesk guide
          you through the rest.
        </p>
        <Link
          to={primaryPath}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:bg-indigo-400 dark:text-stone-950 dark:hover:bg-indigo-300"
        >
          {primaryLabel}
        </Link>
      </section>
    </div>
  )
}
