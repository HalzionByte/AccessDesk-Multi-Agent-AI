import assert from "node:assert/strict"
import test from "node:test"
import { normalizeCase, normalizeOrder } from "./client.js"
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
