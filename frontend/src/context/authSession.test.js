import assert from "node:assert/strict"
import test from "node:test"
import {
  IncompleteAuthenticationError,
  authenticatedUserFrom,
  canSelfEnroll,
  customerName,
  isInvalidEmailLinkError,
} from "./authSession.js"

test("accepts only a completed Firebase credential", () => {
  const user = { uid: "verified-firebase-uid" }
  assert.equal(authenticatedUserFrom({ user }), user)

  for (const credential of [null, {}, { user: null }, { user: { uid: "" } }]) {
    assert.throws(
      () => authenticatedUserFrom(credential),
      IncompleteAuthenticationError,
    )
  }
})

test("recognizes invalid and expired one-time email links", () => {
  assert.equal(
    isInvalidEmailLinkError({ code: "auth/invalid-action-code" }),
    true,
  )
  assert.equal(
    isInvalidEmailLinkError({ code: "auth/expired-action-code" }),
    true,
  )
  assert.equal(isInvalidEmailLinkError({ code: "auth/invalid-email" }), false)
})

test("self-enrollment is limited to accounts that are missing a role", () => {
  assert.equal(canSelfEnroll({ code: "role_required", status: 403 }), true)
  assert.equal(canSelfEnroll({ code: "request_failed", status: 403 }), true)
  assert.equal(canSelfEnroll({ code: "invalid_token", status: 401 }), false)
  assert.equal(canSelfEnroll({ code: "network_error", status: 0 }), false)
})

test("customer names prefer explicit and trusted provider profile values", () => {
  const user = { displayName: "Google Customer", email: "new.user@example.com" }
  assert.equal(customerName(user, "Chosen Name"), "Chosen Name")
  assert.equal(customerName(user, ""), "Google Customer")
  assert.equal(
    customerName({ displayName: "", email: "new.user@example.com" }, ""),
    "new user",
  )
})
