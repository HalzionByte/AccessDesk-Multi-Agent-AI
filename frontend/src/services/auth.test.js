import assert from "node:assert/strict"
import test from "node:test"
import {
  authErrorMessage,
  returnToFromLink,
  safeReturnTo,
  validateEmail,
  validatePassword,
} from "./auth.js"

test("validates email and minimum password length", () => {
  assert.equal(validateEmail(" person@example.com "), true)
  assert.equal(validateEmail("person@"), false)
  assert.equal(validateEmail("person @example.com"), false)
  assert.equal(validatePassword("12345678"), true)
  assert.equal(validatePassword("1234567"), false)
})

test("return paths stay on the same origin", () => {
  globalThis.window = { location: { origin: "https://example.com" } }
  try {
    assert.equal(safeReturnTo("/cases?status=open"), "/cases?status=open")
    assert.equal(safeReturnTo("//evil.example/path"), "/support")
    assert.equal(safeReturnTo("https://evil.example"), "/support")
    assert.equal(safeReturnTo("/auth/finish?oobCode=secret"), "/support")
    assert.equal(safeReturnTo("/login"), "/support")
    assert.equal(
      returnToFromLink(
        "https://example.com/auth/finish?continueUrl=https%3A%2F%2Fexample.com%2Fauth%2Ffinish%3FreturnTo%3D%252Fcases",
      ),
      "/cases",
    )
  } finally {
    delete globalThis.window
  }
})

test("common Firebase errors have actionable messages", () => {
  for (const code of [
    "auth/email-already-in-use",
    "auth/wrong-password",
    "auth/invalid-credential",
    "auth/user-not-found",
    "auth/too-many-requests",
    "auth/popup-closed-by-user",
    "auth/account-exists-with-different-credential",
    "auth/expired-action-code",
    "auth/invalid-action-code",
    "auth/network-request-failed",
  ]) {
    assert.match(authErrorMessage({ code }), /\S+/)
    assert.notEqual(
      authErrorMessage({ code }),
      "Authentication failed. Please try again.",
    )
  }
})
