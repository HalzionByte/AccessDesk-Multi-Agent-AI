import { getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
const env = import.meta.env || {}
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}
export function getFirebaseAuth() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key)
  if (missing.length > 0) {
    throw new Error(
      `Firebase is not configured. Missing: ${missing.join(", ")}.`,
    )
  }
  const app = getApps()[0] || initializeApp(firebaseConfig)
  return getAuth(app)
}
