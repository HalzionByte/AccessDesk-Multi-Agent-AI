import assert from "node:assert/strict"
import test from "node:test"

import {
  legalStaffTransitions,
  matchesCaseSearch,
  requiresDecisionConfirmation,
} from "./staffWorkflow.js"

test("staff controls expose only legal next statuses", () => {
  assert.deepEqual(legalStaffTransitions("Submitted"), ["Under Review"])
  assert.deepEqual(legalStaffTransitions("Under Review"), [
    "Needs Information",
    "Approved",
    "Declined",
  ])
  assert.deepEqual(legalStaffTransitions("Needs Information"), [])
  assert.deepEqual(legalStaffTransitions("Closed"), [])
})

test("case search matches tracking number and useful case fields", () => {
  const item = {
    trackingNo: "AD-2026-0008",
    orderId: "NF-10482",
    product: "Orbit Headphones",
    issue: "Damaged on arrival",
  }
  assert.equal(matchesCaseSearch(item, "0008"), true)
  assert.equal(matchesCaseSearch(item, "headphones"), true)
  assert.equal(matchesCaseSearch(item, "missing"), false)
})

test("only approve and decline require a decision confirmation", () => {
  assert.equal(requiresDecisionConfirmation("Approved"), true)
  assert.equal(requiresDecisionConfirmation("Declined"), true)
  assert.equal(requiresDecisionConfirmation("Closed"), false)
})
