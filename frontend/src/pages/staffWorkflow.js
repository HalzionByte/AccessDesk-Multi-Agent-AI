export const staffTransitions = Object.freeze({
  Submitted: ["Under Review"],
  "Under Review": ["Needs Information", "Approved", "Declined"],
  Approved: ["Closed"],
  Declined: ["Closed"],
  "Needs Information": [],
  Closed: [],
})

export function legalStaffTransitions(status) {
  return staffTransitions[status] || []
}

export function matchesCaseSearch(item, query) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return [item.trackingNo, item.orderId, item.product, item.issue]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase().includes(needle))
}

export function requiresDecisionConfirmation(status) {
  return status === "Approved" || status === "Declined"
}
