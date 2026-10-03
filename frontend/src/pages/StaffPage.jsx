import { useEffect, useMemo, useState } from "react"

import { api } from "../api/client"
import { PageHeader, Timeline } from "../components/shared"
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorBanner,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  Toast,
} from "../components/ui"
import {
  legalStaffTransitions,
  matchesCaseSearch,
  requiresDecisionConfirmation,
} from "./staffWorkflow.js"

const statuses = [
  "Submitted",
  "Under Review",
  "Needs Information",
  "Approved",
  "Declined",
  "Closed",
]

const actionLabels = {
  "Under Review": "Start review",
  "Needs Information": "Request information",
  Approved: "Approve",
  Declined: "Decline",
  Closed: "Close case",
}

function formatBytes(size) {
  if (!Number.isFinite(size)) return "Unknown size"
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(size < 1024 * 10 ? 1 : 0)} KB`
}

export default function StaffPage() {
  const [items, setItems] = useState([])
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState("")
  const [actionError, setActionError] = useState("")
  const [staffNote, setStaffNote] = useState("")
  const [infoRequest, setInfoRequest] = useState("")
  const [updating, setUpdating] = useState(false)
  const [pendingDecision, setPendingDecision] = useState("")
  const [toast, setToast] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      setItems(await api.getStaffCases(statusFilter))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  const visibleItems = useMemo(
    () => items.filter((item) => matchesCaseSearch(item, search)),
    [items, search],
  )

  const openCase = async (caseId) => {
    setDetailLoading(caseId)
    setActionError("")
    try {
      const item = await api.getStaffCase(caseId)
      setDetail(item)
      setStaffNote(item.staffNote || "")
      setInfoRequest(item.staffRequest || "")
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDetailLoading("")
    }
  }

  const applyTransition = async (target) => {
    if (!detail || updating) return
    const cleanedRequest = infoRequest.trim()
    if (target === "Needs Information" && !cleanedRequest) {
      setActionError("Explain what information the customer must provide.")
      return
    }
    setUpdating(true)
    setActionError("")
    try {
      await api.updateStaffCaseStatus(detail.id, {
        status: target,
        note: staffNote.trim() || null,
        infoRequest: target === "Needs Information" ? cleanedRequest : null,
      })
      const [updated, refreshedItems] = await Promise.all([
        api.getStaffCase(detail.id),
        api.getStaffCases(statusFilter),
      ])
      setDetail(updated)
      setItems(refreshedItems)
      setInfoRequest(updated.staffRequest || "")
      setPendingDecision("")
      setToast(`Case moved to ${target}.`)
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setUpdating(false)
    }
  }

  const requestTransition = (target) => {
    if (requiresDecisionConfirmation(target)) {
      setPendingDecision(target)
      return
    }
    applyTransition(target)
  }

  const downloadEvidence = async (attachment) => {
    setActionError("")
    try {
      const file = await api.downloadAttachment(attachment.attachmentId)
      const url = URL.createObjectURL(file.blob)
      const link = document.createElement("a")
      link.href = url
      link.download = file.filename || attachment.filename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (requestError) {
      setActionError(requestError.message)
    }
  }

  const closeDetail = () => {
    setDetail(null)
    setActionError("")
    setPendingDecision("")
  }

  return (
    <>
      <PageHeader
        title="Staff dashboard"
        subtitle="Review customer requests, evidence, policy references, and case history."
      />

      <Card className="mb-5">
        <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
          <Input
            label="Search cases"
            type="search"
            placeholder="Tracking number, order, product, or issue"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && (
        <Card>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-5 h-11 w-full" />
          <Skeleton className="mt-3 h-11 w-full" />
          <Skeleton className="mt-3 h-11 w-full" />
        </Card>
      )}

      {!loading && error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && visibleItems.length === 0 && (
        <EmptyState
          title={items.length ? "No matching cases" : "No cases to review"}
          description={
            items.length
              ? "Try another search or status filter."
              : "Newly submitted customer requests will appear here."
          }
        />
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-stone-900/40 dark:text-stone-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tracking</th>
                  <th className="px-5 py-3 font-semibold">Order / product</th>
                  <th className="px-5 py-3 font-semibold">Issue</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-stone-700">
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 font-semibold">
                      {item.trackingNo}
                    </td>
                    <td className="px-5 py-4">
                      <span className="block font-medium">{item.orderId}</span>
                      <span className="text-slate-500 dark:text-stone-400">
                        {item.product}
                      </span>
                    </td>
                    <td className="max-w-xs px-5 py-4 text-slate-600 dark:text-stone-300">
                      {item.issue}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="secondary"
                        loading={detailLoading === item.id}
                        onClick={() => openCase(item.id)}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog
        open={Boolean(detail)}
        title={detail ? `Case ${detail.trackingNo}` : "Case details"}
        description={
          detail ? `${detail.orderId} · ${detail.product}` : undefined
        }
        onClose={closeDetail}
        actions={
          <Button variant="secondary" onClick={closeDetail}>
            Close
          </Button>
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={detail.status} />
              <span className="text-xs text-slate-500 dark:text-stone-400">
                Submitted {detail.submittedAt}
              </span>
            </div>

            <section>
              <h2 className="text-sm font-semibold">AI summary</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-stone-300">
                {detail.summary}
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold">Customer statement</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-stone-300">
                {detail.statement}
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold">Evidence</h2>
              {detail.attachments?.length ? (
                <ul className="mt-2 space-y-2">
                  {detail.attachments.map((attachment) => (
                    <li
                      key={attachment.attachmentId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-stone-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {attachment.filename}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-stone-400">
                          {attachment.mime} · {formatBytes(attachment.size)}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => downloadEvidence(attachment)}
                      >
                        Download
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                  No evidence files attached.
                </p>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold">Policy references</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.policyRefs?.length ? (
                  detail.policyRefs.map((reference) => (
                    <span
                      key={reference}
                      className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300"
                    >
                      {reference}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500 dark:text-stone-400">
                    No policy references recorded.
                  </span>
                )}
              </div>
            </section>

            {detail.events?.length ? (
              <Timeline events={detail.events} title="Case timeline" />
            ) : (
              <EmptyState
                title="No timeline events"
                description="Workflow and staff events will appear here."
              />
            )}

            {actionError && <ErrorBanner message={actionError} />}

            {legalStaffTransitions(detail.status).length > 0 && (
              <section className="space-y-4 border-t border-slate-200 pt-5 dark:border-stone-700">
                <h2 className="font-semibold">Update case</h2>
                <Textarea
                  label="Internal staff note (optional)"
                  maxLength={4000}
                  value={staffNote}
                  onChange={(event) => setStaffNote(event.target.value)}
                  placeholder="Add context for the next reviewer."
                />
                {detail.status === "Under Review" && (
                  <Textarea
                    label="Information request"
                    maxLength={4000}
                    value={infoRequest}
                    onChange={(event) => setInfoRequest(event.target.value)}
                    placeholder="Tell the customer exactly what is needed."
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  {legalStaffTransitions(detail.status).map((target) => (
                    <Button
                      key={target}
                      variant={target === "Declined" ? "danger" : "primary"}
                      loading={updating && !pendingDecision}
                      disabled={
                        updating ||
                        (target === "Needs Information" && !infoRequest.trim())
                      }
                      onClick={() => requestTransition(target)}
                    >
                      {actionLabels[target]}
                    </Button>
                  ))}
                </div>
              </section>
            )}

            {legalStaffTransitions(detail.status).length === 0 &&
              detail.status !== "Needs Information" && (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-stone-900/40 dark:text-stone-300">
                  This case has no further staff actions.
                </p>
              )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(pendingDecision)}
        title={`${pendingDecision === "Approved" ? "Approve" : "Decline"} this case?`}
        description="This decision is recorded in the case timeline."
        onClose={() => setPendingDecision("")}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={updating}
              onClick={() => setPendingDecision("")}
            >
              Cancel
            </Button>
            <Button
              variant={pendingDecision === "Declined" ? "danger" : "primary"}
              loading={updating}
              onClick={() => applyTransition(pendingDecision)}
            >
              Confirm {pendingDecision.toLocaleLowerCase()}
            </Button>
          </>
        }
      />

      <Toast message={toast} onClose={() => setToast("")} />
    </>
  )
}
