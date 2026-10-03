import { cases, chatResponses, orders } from "../mocks/fixtures"

const useMocks = import.meta.env.VITE_USE_MOCKS !== "false"
const delay = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms))

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request(path, options = {}) {
  if (useMocks) {
    await delay()
    if (path === "/orders") return orders
    if (path === "/cases") return cases
    if (path.startsWith("/chat/")) {
      const scenario = path.split("/").pop()
      if (scenario === "busy")
        throw new ApiError(
          "llm_busy",
          "The assistant is busy. Your draft is saved. Try again.",
          503,
        )
      return chatResponses[scenario] || chatResponses.incomplete
    }
    if (path === "/cases/submit") {
      await delay(300)
      return { trackingNo: "AD-2026-0001" }
    }
  }

  const response = await fetch(`${import.meta.env.VITE_API_URL || ""}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessdesk-token") || ""}`,
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new ApiError(
      data.code || "request_failed",
      data.message || "The request failed. Try again.",
      response.status,
    )
  return data
}

export const api = {
  getOrders: () => request("/orders"),
  getCases: () => request("/cases"),
  getChat: (scenario) => request(`/chat/${scenario}`),
  sendChat: (scenario, message) =>
    request(`/chat/${scenario}`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  submitCase: (draftId, idempotencyKey) =>
    request("/cases/submit", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ draftId }),
    }),
}
