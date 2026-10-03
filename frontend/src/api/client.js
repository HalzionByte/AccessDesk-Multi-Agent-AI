import { cases, chatResponses, orders } from "../mocks/fixtures.js"
const env = import.meta.env || {}
const apiBaseUrl = (env.VITE_API_URL || "").replace(/\/$/, "")
export const isMockMode = env.VITE_USE_MOCKS !== "false"
let authToken = ""
const delay = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms))
export class ApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}
export function setAuthToken(token) {
  authToken = token || ""
}
export function normalizeOrder(order) {
  return { ...order, id: order.id || order.orderId }
}
export function normalizeCase(item) {
  const createdAt = item.createdAt || item.submittedAt
  return {
    ...item,
    id: item.id || item.caseId,
    issue: item.issue || item.issueType,
    statement: item.statement || item.customerStatement,
    evidence:
      item.evidence ||
      item.attachments?.map((attachment) => attachment.filename),
    resolution: item.resolution || "Replacement",
    staffRequest: item.staffRequest || item.infoRequest,
    submittedAt: createdAt
      ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
          new Date(createdAt),
        )
      : "Not available",
  }
}
function appendMockStatusEvent(item, status) {
  const now = new Date().toISOString()
  return {
    ...item,
    status,
    updatedAt: now,
    events: [
      ...(item.events || []),
      {
        actor: "Staff",
        action: "changed case status",
        outcome: status,
        at: now,
      },
    ],
  }
}
async function mockRequest(path, options) {
  await delay()
  if (path === "/me") {
    const role = options.mockRole || "customer"
    return {
      uid: `demo-${role}`,
      name: role === "staff" ? "Demo staff" : "Demo customer",
      email: `${role}@accessdesk.example`,
      role,
      preferredLanguage: "en",
    }
  }
  if (path === "/orders") return orders.map(normalizeOrder)
  if (path === "/cases") return cases.map(normalizeCase)
  if (path.startsWith("/staff/cases")) {
    const [pathname, query = ""] = path.split("?")
    const parts = pathname.split("/").filter(Boolean)
    if (parts.length === 2) {
      const status = new URLSearchParams(query).get("status")
      return cases
        .filter((item) => !status || item.status === status)
        .map(normalizeCase)
    }
    const item = cases.find((candidate) => candidate.id === parts[2])
    if (!item) throw new ApiError("case_not_found", "Case not found.", 404)
    if (parts[3] === "status" && options.method === "PATCH") {
      const payload = JSON.parse(options.body)
      const updated = appendMockStatusEvent(item, payload.status)
      updated.staffNote = payload.note?.trim() || item.staffNote || null
      updated.staffRequest =
        payload.status === "Needs Information"
          ? payload.infoRequest?.trim()
          : null
      Object.assign(item, updated)
      return normalizeCase(item)
    }
    return normalizeCase(item)
  }
  if (path.startsWith("/__mock__/chat/")) {
    const scenario = path.split("/").pop()
    if (scenario === "busy") {
      throw new ApiError(
        "llm_busy",
        "The assistant is busy. Your draft is saved. Try again.",
        503,
      )
    }
    return chatResponses[scenario] || chatResponses.incomplete
  }
  if (path.endsWith("/attachments")) {
    const file = options.body.get("file")
    return {
      attachmentId: crypto.randomUUID(),
      filename: file.name,
      mime: file.type,
      size: file.size,
    }
  }
  if (path.startsWith("/drafts/") && path.endsWith("/submit")) {
    return normalizeCase({
      ...cases[0],
      id: "case-new",
      trackingNo: "AD-2026-0001",
      status: "Submitted",
    })
  }
  if (path.startsWith("/cases/") && path.endsWith("/reply")) {
    const id = path.split("/")[2]
    const item = cases.find((candidate) => candidate.id === id)
    return normalizeCase({
      ...item,
      status: "Under Review",
      staffRequest: null,
    })
  }
  throw new ApiError("not_found", "The requested demo data was not found.", 404)
}
async function request(path, options = {}) {
  if (isMockMode) return mockRequest(path, options)
  const headers = new Headers(options.headers || {})
  headers.set("Accept", "application/json")
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  let response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers })
  } catch {
    throw new ApiError(
      "network_error",
      "The service could not be reached. Check your connection and try again.",
      0,
    )
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      data.code || "request_failed",
      data.message || "The request failed. Try again.",
      response.status,
    )
  }
  return data
}
async function requestFile(path) {
  if (isMockMode) {
    const attachmentId = path.split("/").pop()
    const attachment = cases
      .flatMap((item) => item.attachments || [])
      .find((item) => item.attachmentId === attachmentId)
    if (!attachment)
      throw new ApiError("file_not_found", "File not found.", 404)
    return {
      blob: new Blob(["AccessDesk demo evidence"], { type: attachment.mime }),
      filename: attachment.filename,
    }
  }
  const headers = new Headers({ Accept: "*/*" })
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`)
  let response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { headers })
  } catch {
    throw new ApiError(
      "network_error",
      "The service could not be reached. Check your connection and try again.",
      0,
    )
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(
      data.code || "request_failed",
      data.message || "The file could not be downloaded.",
      response.status,
    )
  }
  const disposition = response.headers.get("content-disposition") || ""
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const fallbackName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  return {
    blob: await response.blob(),
    filename: encodedName ? decodeURIComponent(encodedName) : fallbackName,
  }
}
export const api = {
  getMe: (mockRole) => request("/me", { mockRole }),
  getOrders: async () => (await request("/orders")).map(normalizeOrder),
  getCases: async () => (await request("/cases")).map(normalizeCase),
  getStaffCases: async (status = "") => {
    const query = status ? `?status=${encodeURIComponent(status)}` : ""
    return (await request(`/staff/cases${query}`)).map(normalizeCase)
  },
  getStaffCase: async (caseId) =>
    normalizeCase(await request(`/staff/cases/${encodeURIComponent(caseId)}`)),
  updateStaffCaseStatus: async (caseId, payload) =>
    normalizeCase(
      await request(`/staff/cases/${encodeURIComponent(caseId)}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    ),
  downloadAttachment: (attachmentId) =>
    requestFile(`/files/${encodeURIComponent(attachmentId)}`),
  getDraft: (draftId) => request(`/drafts/${encodeURIComponent(draftId)}`),
  getScenario: (scenario) => {
    if (!isMockMode) {
      throw new ApiError(
        "mock_only",
        "Demo scenarios are available only when mock mode is enabled.",
        400,
      )
    }
    return request(`/__mock__/chat/${scenario}`)
  },
  sendChat: ({ draftId, orderId, message, scenario = "incomplete" }) =>
    isMockMode
      ? request(`/__mock__/chat/${scenario}`, {
          method: "POST",
          body: JSON.stringify({ message }),
        })
      : request("/chat", {
          method: "POST",
          body: JSON.stringify({ draftId, orderId, message }),
        }),
  uploadAttachment: (draftId, file) => {
    const body = new FormData()
    body.append("file", file)
    return request(`/drafts/${encodeURIComponent(draftId)}/attachments`, {
      method: "POST",
      body,
    })
  },
  submitCase: async (draftId, idempotencyKey) =>
    normalizeCase(
      await request(`/drafts/${encodeURIComponent(draftId)}/submit`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey, confirmed: true }),
      }),
    ),
  replyToCase: async (caseId, message) =>
    normalizeCase(
      await request(`/cases/${encodeURIComponent(caseId)}/reply`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    ),
}
