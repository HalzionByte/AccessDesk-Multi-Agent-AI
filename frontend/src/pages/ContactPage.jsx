import { Link } from "react-router"
import { useAuth } from "../context/AuthContext"

const contactMethods = [
  {
    title: "Email support",
    detail: "support@accessdesk.example",
    note: "Best for general questions about this fictional demo.",
    href: "mailto:support@accessdesk.example",
    action: "Write an email",
  },
  {
    title: "Call the demo store",
    detail: "+1 555 010 0199",
    note: "Monday to Saturday, 10:00 to 18:00.",
    href: "tel:+15550100199",
    action: "Call support",
  },
]

const questions = [
  [
    "Where do I report a damaged product?",
    "Sign in as a customer and open Support. Choose the affected order and describe what happened.",
  ],
  [
    "Can the assistant approve a replacement?",
    "No. The assistant prepares and explains requests. Authorized staff approve or decline them.",
  ],
  [
    "Why do I need a product photo?",
    "The fictional replacement policy requires one clear image of the damaged product before submission.",
  ],
]

export default function ContactPage() {
  const { role } = useAuth()
  const supportPath = role === "customer" ? "/support" : "/login"

  return (
    <div className="space-y-16 pb-8">
      <section className="grid gap-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 py-12 text-white sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-14 dark:from-indigo-500 dark:to-indigo-700">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200">
            Contact us
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Questions are welcome
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-indigo-100">
            Need help navigating the demo or preparing a support request? Choose
            the path that fits your question.
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur-sm">
          <p className="font-semibold">Already have an order issue?</p>
          <p className="mt-2 text-sm leading-6 text-indigo-100">
            The support workspace is the fastest way to create a complete,
            trackable request.
          </p>
          <Link
            to={supportPath}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            {role === "customer"
              ? "Open support"
              : "Log in or create an account"}
          </Link>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {contactMethods.map((method) => (
          <article
            key={method.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-800"
          >
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
              {method.title}
            </p>
            <p className="mt-3 text-xl font-bold">{method.detail}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-stone-400">
              {method.note}
            </p>
            <a
              href={method.href}
              className="mt-5 inline-flex font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
            >
              {method.action} →
            </a>
          </article>
        ))}
      </section>

      <section className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            Common questions
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            A little help before you ask
          </h2>
          <p className="mt-4 leading-7 text-slate-600 dark:text-stone-400">
            These answers cover the most common questions about the
            demonstration.
          </p>
        </div>
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-6 dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-800">
          {questions.map(([question, answer]) => (
            <div key={question} className="py-5">
              <h3 className="font-semibold">{question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-stone-400">
                {answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-4 text-center text-sm text-slate-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
        AccessDesk and Northfield Electronics are fictional. These contact
        details are display-only examples for the hackathon demo.
      </p>
    </div>
  )
}
