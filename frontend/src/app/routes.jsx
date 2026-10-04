import { Navigate, createBrowserRouter, useLocation } from "react-router"
import { useAuth } from "../context/AuthContext"
import { safeReturnTo } from "../services/auth"
import AppShell from "../components/shared/AppShell"
import { Spinner } from "../components/ui"
import AboutPage from "../pages/AboutPage"
import CasesPage from "../pages/CasesPage"
import ComponentsPage from "../pages/ComponentsPage"
import ContactPage from "../pages/ContactPage"
import HomePage from "../pages/HomePage"
import LoginPage from "../pages/LoginPage"
import FinishEmailLinkPage from "../pages/FinishEmailLinkPage"
import StaffPage from "../pages/StaffPage"
import SupportPage from "../pages/SupportPage"
function Guard({ role, children }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.initializing)
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  if (!auth.role)
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`}
        replace
      />
    )
  if (auth.role !== role)
    return (
      <Navigate to={auth.role === "staff" ? "/staff" : "/support"} replace />
    )
  return children
}
function GuestOnly({ children }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.initializing || !auth.redirectChecked)
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  if (auth.role) {
    const requested =
      auth.redirectReturnTo ||
      new URLSearchParams(location.search).get("returnTo")
    const fallback = auth.role === "staff" ? "/staff" : "/support"
    const target = safeReturnTo(requested, fallback)
    return <Navigate to={target} replace />
  }
  return children
}
export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: HomePage },
      { path: "about", Component: AboutPage },
      { path: "contact", Component: ContactPage },
      {
        path: "login",
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        path: "signup",
        element: (
          <GuestOnly>
            <LoginPage mode="signup" />
          </GuestOnly>
        ),
      },
      { path: "auth/finish", Component: FinishEmailLinkPage },
      {
        path: "support",
        element: (
          <Guard role="customer">
            <SupportPage />
          </Guard>
        ),
      },
      {
        path: "cases",
        element: (
          <Guard role="customer">
            <CasesPage />
          </Guard>
        ),
      },
      {
        path: "staff",
        element: (
          <Guard role="staff">
            <StaffPage />
          </Guard>
        ),
      },
      { path: "_components", Component: ComponentsPage },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
])
