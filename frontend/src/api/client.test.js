import assert from "node:assert/strict"
import test from "node:test"
import { api, isMockMode, normalizeCase, normalizeOrder } from "./client.js"

test("mock authentication is disabled unless explicitly enabled", () => {
  assert.equal(isMockMode, false)
})

test("identity requests use their explicit Firebase token", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get("Authorization"), "Bearer verified-token")
    assert.equal("accessToken" in options, false)
    return new Response(
      JSON.stringify({ uid: "u1", role: "customer", email: "u@example.com" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }
  try {
    const profile = await api.getMe(undefined, "verified-token")
    assert.equal(profile.role, "customer")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("normalizes backend order identifiers", () => {
  assert.equal(normalizeOrder({ orderId: "NF-1" }).id, "NF-1")
})
test("normalizes backend case fields for the customer screen", () => {
  const item = normalizeCase({
    caseId: "case-1",
    issueType: "Damaged on arrival",
    customerStatement: "The product arrived cracked.",
    infoRequest: "Add another photo.",
    attachments: [{ filename: "damage.jpg" }],
    createdAt: "2026-02-20T10:00:00Z",
  })
  assert.equal(item.id, "case-1")
  assert.equal(item.issue, "Damaged on arrival")
  assert.equal(item.statement, "The product arrived cracked.")
  assert.equal(item.staffRequest, "Add another photo.")
  assert.deepEqual(item.evidence, ["damage.jpg"])
})
