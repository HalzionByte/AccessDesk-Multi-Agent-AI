import assert from "node:assert/strict"
import test from "node:test"
import {
  authenticationErrorMessage,
  validatePasswordlessRegistration,
  validateRegistration,
} from "./authForm.js"

test("registration requires a useful name and strong matching password", () => {
  assert.equal(
    validateRegistration({
      name: "A",
      password: "password123",
      confirmPassword: "password123",
    }),
    "Enter your full name.",
  )
  assert.equal(
    validateRegistration({
      name: "New Customer",
      password: "short",
      confirmPassword: "short",
    }),
    "Use a password containing at least 8 characters.",
  )
  assert.equal(
    validateRegistration({
      name: "New Customer",
      password: "password123",
      confirmPassword: "different123",
    }),
    "The passwords do not match.",
  )
  assert.equal(
    validateRegistration({
      name: "New Customer",
      password: "password123",
      confirmPassword: "password123",
    }),
    "",
  )
})

test("passwordless registration requires an email and useful name", () => {
  assert.equal(
    validatePasswordlessRegistration({ name: "New Customer", email: "" }),
    "Enter your email address.",
  )
  assert.equal(
    validatePasswordlessRegistration({ name: "N", email: "new@example.com" }),
    "Enter your full name.",
  )
  assert.equal(
    validatePasswordlessRegistration({
      name: "New Customer",
      email: "new@example.com",
    }),
    "",
  )
})

test("authentication errors provide safe actionable messages", () => {
  assert.match(
    authenticationErrorMessage(
      { code: "auth/email-already-in-use" },
      "register",
    ),
    /already exists/,
  )
  assert.doesNotMatch(
    authenticationErrorMessage(new Error("secret internal detail"), "register"),
    /secret internal detail/,
  )
  assert.match(
    authenticationErrorMessage({ code: "auth/operation-not-allowed" }, "login"),
    /not enabled/,
  )
  assert.match(
    authenticationErrorMessage({ code: "auth/expired-action-code" }, "login"),
    /expired/,
  )
  assert.match(
    authenticationErrorMessage({ code: "auth/incomplete-sign-in" }, "login"),
    /not completed/,
  )
  assert.match(
    authenticationErrorMessage({ code: "invalid_token" }, "login"),
    /invalid or expired/,
  )
  assert.match(
    authenticationErrorMessage({ code: "registration_unavailable" }, "login"),
    /account setup/,
  )
})
