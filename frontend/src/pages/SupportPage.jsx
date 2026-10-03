import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { api, isMockMode } from "../api/client"
import {
  ChatBubble,
  Checklist,
  PageHeader,
  Timeline,
  TypingIndicator,
} from "../components/shared"
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  Select,
  StatusBadge,
  Toast,
} from "../components/ui"
const scenarios = [
  { id: "complete", label: "S1 Complete" },
  { id: "incomplete", label: "S1 Incomplete" },
  { id: "repeat", label: "S3 Repeat" },
  { id: "late", label: "S4 Late" },
]
export default function SupportPage() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const chatRef = useRef(null)
  const submissionKeyRef = useRef("")
  const [scenario, setScenario] = useState("complete")
  const [data, setData] = useState(null)
  const [orders, setOrders] = useState([])
  const [orderId, setOrderId] = useState("NF-10482")
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState("")
  const [toast, setToast] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [trackingNo, setTrackingNo] = useState("")
  const [lastMessage, setLastMessage] = useState("")
  const loadScenario = async (nextScenario = scenario) => {
    setBusy(true)
    setError("")
    setTrackingNo("")
    setLastMessage("")
    submissionKeyRef.current = ""
    try {
      const orderList = await api.getOrders()
      const response = isMockMode ? await api.getScenario(nextScenario) : null
      setData(response)
      setOrders(orderList)
      setOrderId(
        response?.preview?.orderId ||
          response?.fields?.orderId ||
          orderList[0]?.id ||
          "",
      )
      setMessages(
        response?.reply
          ? [
              {
                role: "assistant",
                text: response.reply,
                citations: response.citations,
              },
            ]
          : [],
      )
      setFiles(
        response?.preview?.attachments?.map((attachment) => ({
          name:
            typeof attachment === "string" ? attachment : attachment.filename,
          attachmentId:
            typeof attachment === "string"
              ? undefined
              : attachment.attachmentId,
          demo: isMockMode,
        })) || [],
      )
    } catch (requestError) {
      setError(
        requestError.code === "llm_busy"
          ? "The assistant is busy. Your draft is saved. Try again."
          : requestError.message,
      )
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    loadScenario(scenario)
  }, [scenario])
  // Keep the newest message in view without letting the transcript grow the
  // page, so the composer below it stays at a fixed position.
  useEffect(() => {
    const node = chatRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, busy, error])
  const runChat = async (userText, appendUser = true) => {
    if (!userText || busy) return
    if (appendUser) {
      setMessages((current) => [...current, { role: "user", text: userText }])
      setMessage("")
    }
    setLastMessage(userText)
    setBusy(true)
    setError("")
    try {
      const response = await api.sendChat({
        draftId: data?.draftId,
        orderId,
        message: userText,
        scenario:
          isMockMode && userText.toLowerCase().includes("busy")
            ? "busy"
            : scenario,
      })
      setData(response)
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.reply,
          citations: response.citations,
        },
      ])
    } catch (requestError) {
      setError(
        requestError.code === "llm_busy"
          ? "The assistant is busy. Your draft is saved. Try again."
          : requestError.message,
      )
    } finally {
      setBusy(false)
    }
  }
  const sendMessage = async (event) => {
    event.preventDefault()
    await runChat(message.trim())
  }
  const addFiles = (event) => {
    const selected = Array.from(event.target.files || [])
    setFileError("")
    if (files.length + selected.length > 3) {
      setFileError("Add up to 3 files. Remove a file and try again.")
      return
    }
    const allowed = ["image/jpeg", "image/png", "application/pdf"]
    const invalid = selected.find(
      (file) => !allowed.includes(file.type) || file.size > 5 * 1024 * 1024,
    )
    if (invalid) {
      setFileError("Use JPG, PNG, or PDF files up to 5 MB each.")
      return
    }
    setFiles((current) => [...current, ...selected])
    event.target.value = ""
  }
  const submit = async () => {
    if (submitting || trackingNo || !data?.draftId) return
    setSubmitting(true)
    setError("")
    try {
      const uploadedFiles = [...files]
      for (const [index, file] of files.entries()) {
        if (file instanceof File && !file.demo && !file.attachmentId) {
          const attachment = await api.uploadAttachment(data.draftId, file)
          uploadedFiles[index] = {
            ...attachment,
            name: attachment.filename,
          }
          setFiles([...uploadedFiles])
        }
      }
      const key = submissionKeyRef.current || crypto.randomUUID()
      submissionKeyRef.current = key
      const result = await api.submitCase(data.draftId, key)
      setTrackingNo(result.trackingNo)
      setData((current) => ({
        ...current,
        events: [
          ...(current?.events || []),
          {
            actor: "customer",
            action: "Customer confirmed submission",
            outcome: "Request confirmed",
            at: new Date().toISOString(),
          },
          {
            actor: "system",
            action: "Case created",
            outcome: result.trackingNo,
            at: new Date().toISOString(),
          },
        ],
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }
  const visibleChecklist =
    data?.checklist?.map((item) =>
      item.key === "photo" ? { ...item, done: files.length > 0 } : item,
    ) || []
  const complete =
    visibleChecklist.length > 0 && visibleChecklist.every((item) => item.done)
  // A damaged-product report needs an order to attach it to, so an account
  // with no orders cannot start a draft.
  const noOrders = !busy && !error && orders.length === 0
  return (
    <>
      <PageHeader
        title="Report a damaged product"
        subtitle="Tell us what happened. The assistant will collect the details staff need."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
        <div className="min-w-0">
          {noOrders ? (
            <EmptyState
              title="No orders yet"
              description="We could not find an order on your account. Report damage once an order shows here."
              action={
                <Button variant="secondary" onClick={() => navigate("/cases")}>
                  View my cases
                </Button>
              }
            />
          ) : (
            <Card>
              <Select
                label="Order"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.id} · {order.product}
                  </option>
                ))}
              </Select>
              {isMockMode && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-stone-400">
                    Mock scenario
                  </span>
                  {scenarios.map((item) => (
                    <Button
                      key={item.id}
                      variant={scenario === item.id ? "primary" : "secondary"}
                      className="min-h-9 px-3 py-1.5"
                      onClick={() => setScenario(item.id)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="my-3 h-px bg-slate-200 dark:bg-stone-700" />
              <div
                ref={chatRef}
                className="h-[20rem] space-y-4 overflow-y-auto overscroll-contain pr-1 sm:h-[24rem]"
                style={{
                  maskImage:
                    "linear-gradient(to bottom, transparent 0, #000 14px, #000 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0, #000 14px, #000 100%)",
                }}
                aria-live="polite"
              >
                {messages.map((item, index) => (
                  <ChatBubble
                    key={index}
                    role={item.role}
                    citations={item.citations}
                    onCitation={(citation) =>
                      setToast(`${citation.title}: ${citation.text}`)
                    }
                  >
                    {item.text}
                  </ChatBubble>
                ))}
                {messages.length === 0 && !busy && !error && (
                  <EmptyState
                    title="No messages yet"
                    description="Describe the damage in English or Roman Urdu to start."
                  />
                )}
                {busy && <TypingIndicator />}
                {error && (
                  <ErrorBanner
                    message={error}
                    onRetry={() =>
                      isMockMode || !lastMessage
                        ? loadScenario(scenario)
                        : runChat(lastMessage, false)
                    }
                  />
                )}
              </div>
              <form className="mt-3 flex gap-2" onSubmit={sendMessage}>
                <Input
                  aria-label="Message"
                  containerClassName="min-w-0 flex-1"
                  className="min-h-11"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Describe the damage in English or Roman Urdu…"
                />
                <Button type="submit" loading={busy} disabled={!message.trim()}>
                  Send
                </Button>
              </form>
              {isMockMode && (
                <p className="mt-2 text-xs text-slate-500 dark:text-stone-500">
                  Demo tip: send “busy” to preview the saved-draft retry state.
                </p>
              )}
            </Card>
          )}
        </div>
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {data && !noOrders && (
            <>
              <Card>
                <p className="text-lg font-semibold">What we still need</p>
                <p className="mt-1 mb-5 text-sm text-slate-600 dark:text-stone-400">
                  Complete each item before submitting.
                </p>
                <Checklist items={visibleChecklist} />
                <div className="mt-5 border-t border-slate-200 pt-5 dark:border-stone-700">
                  <Input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={addFiles}
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => fileRef.current?.click()}
                  >
                    Add photo or PDF
                  </Button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-stone-400">
                    JPG, PNG, or PDF. Up to 5 MB each, 3 files maximum.
                  </p>
                  {fileError && (
                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                      {fileError}
                    </p>
                  )}
                  {files.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {files.map((file, index) => (
                        <span
                          key={`${file.name}-${index}`}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:bg-stone-700 dark:text-stone-200"
                        >
                          {file.name}
                          <Button
                            variant="ghost"
                            square
                            className="size-6 font-bold"
                            onClick={() =>
                              setFiles((current) =>
                                current.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                            aria-label={`Remove ${file.name}`}
                          >
                            ×
                          </Button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
              {data.preview?.window?.toLowerCase().includes("past") && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                  This order is past the 7-day window. Staff will review it.
                  Approval is not guaranteed.
                </div>
              )}
              {data.existingCase && (
                <Card>
                  <p className="text-sm font-medium text-slate-500 dark:text-stone-400">
                    Existing case
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xl font-bold">
                      {data.existingCase.trackingNo}
                    </p>
                    <StatusBadge status={data.existingCase.status} />
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-5 w-full"
                    onClick={() => navigate("/cases")}
                  >
                    View my cases
                  </Button>
                </Card>
              )}
              {complete && data.preview && !trackingNo && (
                <Card>
                  <p className="text-lg font-semibold">Request preview</p>
                  <dl className="mt-4 space-y-3 text-sm">
                    {[
                      [
                        "Order",
                        `${data.preview.orderId} · ${data.preview.product}`,
                      ],
                      ["Issue", data.preview.issue],
                      ["Your statement", data.preview.statement],
                      [
                        "Evidence",
                        files.map((file) => file.name).join(", ") || "None",
                      ],
                      ["Resolution", data.preview.resolution],
                      ["Window", data.preview.window],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="grid gap-1 sm:grid-cols-[7rem_1fr]"
                      >
                        <dt className="text-slate-500 dark:text-stone-400">
                          {label}
                        </dt>
                        <dd className="font-medium text-slate-800 dark:text-stone-200">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <Button
                    className="mt-5 w-full"
                    loading={submitting}
                    disabled={submitting}
                    onClick={submit}
                  >
                    Confirm and submit
                  </Button>
                  <p className="mt-2 text-center text-xs text-slate-500 dark:text-stone-400">
                    Staff will review your request. Submission does not mean
                    approval.
                  </p>
                </Card>
              )}
              {trackingNo && (
                <Card className="border-emerald-200 dark:border-emerald-400/30">
                  <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                    ✓
                  </div>
                  <p className="mt-4 text-lg font-semibold">
                    Request submitted
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-stone-400">
                    Track it with this number.
                  </p>
                  <p className="mt-3 text-xl font-bold tracking-tight">
                    {trackingNo}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-5 w-full"
                    onClick={() => navigate("/cases")}
                  >
                    View my cases
                  </Button>
                </Card>
              )}
              <Timeline events={data.events} />
            </>
          )}
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast("")} />
    </>
  )
}
