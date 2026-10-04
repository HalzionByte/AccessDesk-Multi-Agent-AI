import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const env = import.meta.env || {}
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

function firebaseApp() {
  if (Object.values(config).some((value) => !value)) {
    throw new Error(
      "Firebase web configuration is incomplete. Check the VITE_FIREBASE_* values in .env.",
    )
  }
  return getApps().length ? getApp() : initializeApp(config)
}

export const getFirebaseAuth = () => getAuth(firebaseApp())
export const getFirebaseDatabase = () => getFirestore(firebaseApp())
