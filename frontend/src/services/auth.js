import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  isSignInWithEmailLink,
  linkWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "firebase/auth"
import { doc, runTransaction, serverTimestamp } from "firebase/firestore"
import { getFirebaseAuth, getFirebaseDatabase } from "../firebase.js"

const EMAIL_LINK_KEY = "accessdesk-email-link"
const GOOGLE_RETURN_KEY = "accessdesk-google-return"

export function safeReturnTo(value, fallback = "/support") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return fallback
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin &&
      !["/login", "/signup"].includes(url.pathname) &&
      !url.pathname.startsWith("/auth/")
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback
  } catch {
    return fallback
  }
}

export function returnToFromLink(url) {
  try {
    const link = new URL(url)
    const direct = link.searchParams.get("returnTo")
    if (direct) return safeReturnTo(direct)
    const continueUrl = link.searchParams.get("continueUrl")
    return continueUrl
      ? safeReturnTo(new URL(continueUrl).searchParams.get("returnTo"))
      : "/support"
  } catch {
    return "/support"
  }
}

export function authErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use":
      "This email already has an account. Use Google or an email link if you used those before; otherwise sign in or reset your password.",
    "auth/wrong-password": "The password is incorrect. Try again or reset it.",
    "auth/invalid-credential":
      "These credentials were not accepted. Check them or use the sign-in method you used before.",
    "auth/user-not-found":
      "No account was found for this email. Check the address or sign up.",
    "auth/too-many-requests":
      "Too many attempts. Wait a little before trying again.",
    "auth/popup-closed-by-user":
      "Google sign-in was cancelled. Try again when you're ready.",
    "auth/cancelled-popup-request":
      "Another sign-in window was opened. Please try again.",
    "auth/account-exists-with-different-credential":
      "This email already uses another sign-in method. Sign in with the method you used before, or use a fresh email link.",
    "auth/credential-already-in-use":
      "This sign-in link belongs to an existing account. Sign out and use the link for that account.",
    "auth/expired-action-code":
      "This email link has expired. Request a new one.",
    "auth/invalid-action-code":
      "This email link is invalid or has already been used. Request a new one.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password":
      "Choose a stronger password with at least 8 characters.",
    "auth/network-request-failed":
      "Network error. Check your connection and try again.",
    "auth/unauthorized-domain":
      "This website is not authorized in Firebase Authentication settings.",
    "permission-denied":
      "Your profile could not be saved. Check the Firestore rules and try again.",
  }
  return (
    messages[error?.code] ||
    error?.message ||
    "Authentication failed. Please try again."
  )
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= 8
}

async function readyAuth() {
  const auth = getFirebaseAuth()
  await setPersistence(auth, browserLocalPersistence)
  return auth
}

export async function syncUserDocument(user) {
  if (!user.email)
    throw new Error("This Firebase account did not provide an email address.")
  const reference = doc(getFirebaseDatabase(), "users", user.uid)
  await runTransaction(getFirebaseDatabase(), async (transaction) => {
    const snapshot = await transaction.get(reference)
    const timestamp = serverTimestamp()
    if (snapshot.exists()) {
      transaction.update(reference, {
        lastLoginAt: timestamp,
        updatedAt: timestamp,
      })
      return
    }
    transaction.set(reference, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split("@")[0] || "Customer",
      photoURL: user.photoURL || null,
      providers: user.providerData.map((provider) => provider.providerId),
      emailVerified: user.emailVerified,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: timestamp,
    })
  })
}

export async function signUpWithEmail({ name, email, password }) {
  const credential = await createUserWithEmailAndPassword(
    await readyAuth(),
    email.trim(),
    password,
  )
  await updateProfile(credential.user, { displayName: name.trim() })
  await sendEmailVerification(credential.user)
  await syncUserDocument(credential.user)
  return credential.user
}

export async function signInWithEmail(email, password) {
  return (
    await signInWithEmailAndPassword(await readyAuth(), email.trim(), password)
  ).user
}

function savedLinkRequest() {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_LINK_KEY)) || {}
  } catch {
    return {}
  }
}

export async function sendLoginLink(email, returnTo = "/support", name = "") {
  const auth = await readyAuth()
  const url = new URL("/auth/finish", window.location.origin)
  url.searchParams.set("returnTo", safeReturnTo(returnTo))
  await sendSignInLinkToEmail(auth, email.trim(), {
    url: url.toString(),
    handleCodeInApp: true,
  })
  try {
    localStorage.setItem(
      EMAIL_LINK_KEY,
      JSON.stringify({ email: email.trim(), name: name.trim() }),
    )
  } catch {
    // The completion page prompts for the email if browser storage is unavailable.
  }
}

export function savedEmailForLink() {
  return savedLinkRequest().email || ""
}

export function isLoginLink(url = window.location.href) {
  return isSignInWithEmailLink(getFirebaseAuth(), url)
}

export async function completeEmailLinkSignIn(
  email,
  url = window.location.href,
) {
  const auth = await readyAuth()
  if (!isSignInWithEmailLink(auth, url)) {
    const error = new Error("This email sign-in link is invalid or expired.")
    error.code = "auth/invalid-action-code"
    throw error
  }
  const normalizedEmail = email.trim()
  let user
  if (
    auth.currentUser?.email?.toLowerCase() === normalizedEmail.toLowerCase()
  ) {
    const credential = EmailAuthProvider.credentialWithLink(
      normalizedEmail,
      url,
    )
    try {
      user = (await linkWithCredential(auth.currentUser, credential)).user
    } catch (error) {
      if (error.code !== "auth/provider-already-linked") throw error
      user = (await signInWithEmailLink(auth, normalizedEmail, url)).user
    }
  } else if (auth.currentUser) {
    await signOut(auth)
    user = (await signInWithEmailLink(auth, normalizedEmail, url)).user
  } else {
    user = (await signInWithEmailLink(auth, normalizedEmail, url)).user
  }
  const saved = savedLinkRequest()
  if (
    !user.displayName &&
    saved.email?.toLowerCase() === normalizedEmail.toLowerCase() &&
    saved.name
  ) {
    await updateProfile(user, { displayName: saved.name })
  }
  try {
    localStorage.removeItem(EMAIL_LINK_KEY)
  } catch {
    /* Storage may be blocked. */
  }
  return user
}

export async function signInWithGoogle(returnTo = "/support") {
  const auth = await readyAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: "select_account" })
  try {
    return (await signInWithPopup(auth, provider)).user
  } catch (error) {
    if (
      ![
        "auth/popup-blocked",
        "auth/operation-not-supported-in-this-environment",
      ].includes(error.code)
    )
      throw error
    try {
      sessionStorage.setItem(GOOGLE_RETURN_KEY, safeReturnTo(returnTo))
    } catch {
      /* Continue without a saved return path. */
    }
    await signInWithRedirect(auth, provider)
    return null
  }
}

export async function finishGoogleRedirect() {
  const result = await getRedirectResult(await readyAuth())
  if (!result) return null
  let returnTo = null
  try {
    returnTo = sessionStorage.getItem(GOOGLE_RETURN_KEY)
    sessionStorage.removeItem(GOOGLE_RETURN_KEY)
  } catch {
    /* Continue with the default workspace path. */
  }
  return { user: result.user, returnTo: safeReturnTo(returnTo) }
}

export const resetPassword = async (email) =>
  sendPasswordResetEmail(await readyAuth(), email.trim())
export const resendVerification = async (user) => sendEmailVerification(user)
export async function refreshUser(user) {
  await reload(user)
  await user.getIdToken(true)
  return getFirebaseAuth().currentUser || user
}
export const logout = async () => signOut(getFirebaseAuth())
