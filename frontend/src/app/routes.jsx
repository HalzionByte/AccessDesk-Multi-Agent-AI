import { Navigate, createBrowserRouter } from "react-router"
import { useAuth } from "../context/AuthContext"
import AppShell from "../components/shared/AppShell"
import CasesPage from "../pages/CasesPage"
import ComponentsPage from "../pages/ComponentsPage"
import LoginPage from "../pages/LoginPage"
import StaffPage from "../pages/StaffPage"
import SupportPage from "../pages/SupportPage"

function Guard({ role, children }) {
  const auth = useAuth()
  if (!auth.role) return <Navigate to="/login" replace />
  if (auth.role !== role)
    return (
      <Navigate to={auth.role === "staff" ? "/staff" : "/support"} replace />
    )
  return children
}

function Home() {
  const { role } = useAuth()
  return (
    <Navigate
      to={
        role === "staff"
          ? "/staff"
          : role === "customer"
            ? "/support"
            : "/login"
      }
      replace
    />
  )
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: Home },
      { path: "login", Component: LoginPage },
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
