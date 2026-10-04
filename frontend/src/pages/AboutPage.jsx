import { Link } from "react-router"

const principles = [
  {
    title: "AI explains; people decide",
    text: "Agents organize information and explain policy, while authorized staff retain every approval decision.",
  },
  {
    title: "Your request stays yours",
    text: "Authentication and ownership checks protect orders, drafts, files, and cases at every backend boundary.",
  },
  {
    title: "Progress should be visible",
    text: "Checklists, citations, previews, and timelines make each step understandable instead of hiding it behind automation.",
  },
  {
    title: "Language should not be a barrier",
    text: "Customers can explain damaged deliveries in English or Roman Urdu and receive focused follow-up questions.",
  },
]

export default function AboutPage() {
  return (
    <div className="space-y-16 pb-8">
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
          About AccessDesk
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Support technology built around clarity and control
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-stone-300">
          AccessDesk is a hackathon project exploring how small online stores
          can use focused AI agents without handing critical business decisions
          to a model.
        </p>
      </section>

      <section className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white lg:grid-cols-2 dark:border-stone-700 dark:bg-stone-800">
        <div className="p-7 sm:p-10">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            Our purpose
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Make difficult support moments feel manageable
          </h2>
          <p className="mt-5 leading-7 text-slate-600 dark:text-stone-300">
            Reporting a damaged product often means finding order numbers,
            interpreting policy, collecting photos, and repeating details. We
            designed AccessDesk to turn that scattered process into one calm,
            guided conversation.
          </p>
        </div>
        <div className="bg-indigo-600 p-7 text-white sm:p-10 dark:bg-indigo-400 dark:text-stone-950">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-100 dark:text-indigo-950">
            The boundary that matters
          </p>
          <p className="mt-5 text-2xl font-semibold leading-9">
            AI understands the request. Trusted code verifies it. A human makes
            the final decision.
          </p>
          <p className="mt-6 text-sm leading-6 text-indigo-100 dark:text-indigo-950">
            AccessDesk cannot approve claims, issue payments, change staff
            statuses, or create a case without explicit customer confirmation.
          </p>
        </div>
      </section>

      <section aria-labelledby="principles-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            Design principles
          </p>
          <h2
            id="principles-title"
            className="mt-2 text-3xl font-bold tracking-tight"
          >
            Useful automation, sensible limits
          </h2>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {principles.map((principle) => (
            <article
              key={principle.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800"
            >
              <h3 className="text-lg font-semibold">{principle.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-stone-400">
                {principle.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 sm:p-10 dark:border-amber-400/20 dark:bg-amber-400/10">
        <h2 className="text-2xl font-bold">A fictional demonstration</h2>
        <p className="mt-3 max-w-3xl leading-7 text-slate-700 dark:text-stone-300">
          Northfield Electronics, its customers, orders, policies, contact
          details, and support cases are fictional. They exist to demonstrate a
          safe agent-assisted workflow and do not represent a real retailer or
          customer promise.
        </p>
        <Link
          to="/contact"
          className="mt-5 inline-flex font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
        >
          Contact the demo team →
        </Link>
      </section>
    </div>
  )
}
