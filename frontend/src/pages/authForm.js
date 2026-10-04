export function validateRegistration({ name, password, confirmPassword }) {
  if (name.trim().length < 2) return "Enter your full name."
  if (password.length < 8)
    return "Use a password containing at least 8 characters."
  if (password !== confirmPassword) return "The passwords do not match."
  return ""
}

export function validatePasswordlessRegistration({ name, email }) {
  if (!email.trim()) return "Enter your email address."
  if (name.trim().length < 2) return "Enter your full name."
  return ""
}

export function authenticationErrorMessage(error, mode) {
  if (error?.code === "auth/email-already-in-use") {
    return "An account already exists for this email. Log in instead."
  }
  if (error?.code === "auth/invalid-email")
    return "Enter a valid email address."
  if (error?.code === "auth/weak-password") {
    return "Use a stronger password containing at least 8 characters."
  }
  if (error?.code === "auth/invalid-credential") {
    return "The email or password is incorrect."
  }
  if (error?.code === "auth/incomplete-sign-in") {
    return "Sign-in was not completed. Please try again."
  }
  if (error?.code === "auth/popup-closed-by-user") {
    return "The Google sign-in window was closed before sign-in finished."
  }
  if (error?.code === "auth/popup-blocked") {
    return "Your browser blocked the Google sign-in window. Allow pop-ups and try again."
  }
  if (error?.code === "auth/unauthorized-domain") {
    return "This domain is not authorized in Firebase Authentication."
  }
  if (error?.code === "auth/operation-not-allowed") {
    return "This sign-in method is not enabled in Firebase Authentication."
  }
  if (
    error?.code === "auth/invalid-action-code" ||
    error?.code === "auth/expired-action-code"
  ) {
    return "This email sign-in link is invalid or expired. Request a new link."
  }
  if (
    error?.code === "auth/network-request-failed" ||
    error?.code === "network_error"
  ) {
    return "The authentication service could not be reached. Check your connection and try again."
  }
  if (error?.code === "auth/too-many-requests") {
    return "Too many sign-in attempts were made. Wait a little and try again."
  }
  if (error?.code === "role_required") {
    return "This account is not fully registered. Use Create account to finish setting it up."
  }
  if (
    error?.code === "authentication_required" ||
    error?.code === "invalid_token"
  ) {
    return "Your authentication session is invalid or expired. Sign in again."
  }
  if (error?.code === "registration_unavailable") {
    return "You are signed in, but account setup is temporarily unavailable. Try again."
  }
  return mode === "register"
    ? "We could not create your account. Check the details and try again."
    : "We could not log you in. Check your credentials and configuration, then try again."
}
