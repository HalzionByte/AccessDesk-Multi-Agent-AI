import { useEffect, useState } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router"
import { useAuth } from "../../context/AuthContext"
import { useTheme } from "../../context/ThemeContext"
import { Button } from "../ui"

const CONTACT = {
  business: "Northfield Electronics (fictional)",
  email: "support@accessdesk.example",
  phone: "+1 555 010 0199",
  phoneHref: "+15550100199",
  hours: "Mon to Sat, 10:00 to 18:00",
}

function NavItem({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400 ${
          isActive
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-100"
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function ThemeIcon({ dark }) {
  return dark ? (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M20.5 15.2A8.5 8.5 0 018.8 3.5a8.5 8.5 0 1011.7 11.7z" />
    </svg>
  )
}

export default function AppShell() {
  const { role, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0)
      setShowTop(window.scrollY > 300)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setUserOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const workspaceNav =
    role === "customer" ? (
      <>
        <NavItem to="/support">Support</NavItem>
        <NavItem to="/cases">My cases</NavItem>
      </>
    ) : role === "staff" ? (
      <NavItem to="/staff">Dashboard</NavItem>
    ) : null

  const nav = (
    <>
      <NavItem to="/">Home</NavItem>
      <NavItem to="/about">About</NavItem>
      <NavItem to="/contact">Contact</NavItem>
      {workspaceNav}
    </>
  )

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-stone-900 dark:text-stone-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-stone-700 dark:bg-stone-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white dark:bg-indigo-400 dark:text-stone-900">
              A
            </span>
            AccessDesk
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">{nav}</nav>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              square
              className="size-11"
              onClick={toggle}
              aria-label={dark ? "Use light mode" : "Use dark mode"}
            >
              <ThemeIcon dark={dark} />
            </Button>
            {role && (
              <div className="relative">
                <Button
                  variant="ghost"
                  className="capitalize"
                  onClick={() => setUserOpen((value) => !value)}
                  aria-expanded={userOpen}
                >
                  {role}
                  <span aria-hidden>⌄</span>
                </Button>
                {userOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-stone-600 dark:bg-stone-700">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        logout()
                        navigate("/login")
                      }}
                    >
                      Log out
                    </Button>
                  </div>
                )}
              </div>
            )}
            {!role && (
              <Button variant="secondary" onClick={() => navigate("/login")}>
                Log in
              </Button>
            )}
            <Button
              variant="ghost"
              square
              className="size-10 md:hidden"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              Menu
            </Button>
          </div>
        </div>
        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-slate-200 p-3 md:hidden dark:border-stone-700">
            {nav}
          </nav>
        )}
        <div className="h-[3px] bg-slate-100 dark:bg-stone-700">
          <div
            className="h-full bg-indigo-600 transition-[width] dark:bg-indigo-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-stone-700 dark:bg-stone-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-bold text-slate-900 dark:text-stone-100">
              AccessDesk
            </p>
            <p className="mt-1 text-slate-500 dark:text-stone-400">
              Demo data is fictional.
            </p>
            <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-slate-600 dark:text-stone-400">
              <Link className="hover:text-indigo-600 hover:underline" to="/">
                Home
              </Link>
              <Link
                className="hover:text-indigo-600 hover:underline"
                to="/about"
              >
                About
              </Link>
              <Link
                className="hover:text-indigo-600 hover:underline"
                to="/contact"
              >
                Contact
              </Link>
            </nav>
          </div>
          <div className="space-y-1 text-slate-600 md:text-right dark:text-stone-400">
            <p className="font-medium text-slate-800 dark:text-stone-200">
              {CONTACT.business}
            </p>
            <p>
              <a
                className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-300"
                href={`mailto:${CONTACT.email}`}
              >
                {CONTACT.email}
              </a>
            </p>
            <p>
              <a
                className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-300"
                href={`tel:${CONTACT.phoneHref}`}
              >
                {CONTACT.phone}
              </a>
            </p>
            <p>{CONTACT.hours}</p>
          </div>
        </div>
      </footer>
      {showTop && (
        <Button
          square
          className="fixed bottom-5 right-5 z-30 size-11 rounded-full shadow-lg"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
        >
          Top
        </Button>
      )}
    </div>
  )
}
