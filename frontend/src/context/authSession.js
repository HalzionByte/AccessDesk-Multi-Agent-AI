export class IncompleteAuthenticationError extends Error {
  constructor() {
    super("Firebase did not return an authenticated user.")
    this.name = "IncompleteAuthenticationError"
    this.code = "auth/incomplete-sign-in"
  }
}

export function authenticatedUserFrom(credential) {
  const user = credential?.user
  if (!user || typeof user.uid !== "string" || !user.uid.trim()) {
    throw new IncompleteAuthenticationError()
  }
  return user
}

export function canSelfEnroll(error) {
  return error?.code === "role_required" || error?.status === 403
}

export function customerName(firebaseUser, requestedName) {
  const preferredName =
    requestedName?.trim() || firebaseUser.displayName?.trim()
  if (preferredName?.length >= 2) return preferredName
  const emailName = firebaseUser.email?.split("@")[0]?.replace(/[._-]+/g, " ")
  return emailName?.trim().length >= 2
    ? emailName.trim()
    : "AccessDesk customer"
}

export function isInvalidEmailLinkError(error) {
  return (
    error?.code === "auth/invalid-action-code" ||
    error?.code === "auth/expired-action-code"
  )
}
