import { useState } from "react"
import {
  ChatBubble,
  Checklist,
  CitationChip,
  PageHeader,
  Timeline,
  TypingIndicator,
} from "../components/shared"
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorBanner,
  Input,
  Select,
  Skeleton,
  Spinner,
  StatusBadge,
  Textarea,
  Toast,
} from "../components/ui"
const statuses = [
  "Draft",
  "Submitted",
  "Under Review",
  "Needs Information",
  "Approved",
  "Declined",
  "Closed",
]
const events = [
  { action: "Intake Agent collected order details", outcome: "Order found" },
  {
    action: "Policy Agent retrieved replacement requirements",
    outcome: "Policy P-3 checked",
  },
]
export default function ComponentsPage() {
  const [toast, setToast] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  return (
    <>
      <PageHeader
        title="Shared components"
        subtitle="The AccessDesk interface inventory and interaction states."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-4 text-lg font-semibold">Buttons</p>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>
        <Card>
          <p className="mb-4 text-lg font-semibold">Status badges</p>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </Card>
        <Card>
          <p className="mb-4 text-lg font-semibold">Fields</p>
          <div className="space-y-4">
            <Input label="Email" placeholder="you@example.com" />
            <Input label="Order" error="Enter an order number." />
            <Input label="Disabled field" value="Unavailable" disabled />
            <Select label="Resolution">
              <option>Replacement</option>
              <option>Refund</option>
            </Select>
            <Textarea
              label="Description"
              placeholder="Describe what happened…"
            />
          </div>
        </Card>
        <Card>
          <p className="mb-4 text-lg font-semibold">Loading</p>
          <div className="flex items-center gap-3">
            <Spinner />
            <span className="text-sm text-slate-600 dark:text-stone-400">
              Loading request
            </span>
          </div>
          <Skeleton className="mt-5 h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <div className="mt-5">
            <TypingIndicator />
          </div>
        </Card>
        <Card>
          <p className="mb-4 text-lg font-semibold">Chat</p>
          <div className="space-y-3">
            <ChatBubble
              role="assistant"
              citations={[{ id: "P-3", title: "Policy", text: "Add a photo." }]}
              onCitation={(item) => setToast(`${item.title}: ${item.text}`)}
            >
              Please add a clear photo of the damage.
            </ChatBubble>
            <ChatBubble role="user">The left side is cracked.</ChatBubble>
            <CitationChip
              citation={{ id: "P-3" }}
              onClick={() => setToast("Damaged item policy")}
            />
          </div>
        </Card>
        <Card>
          <p className="mb-4 text-lg font-semibold">Checklist</p>
          <Checklist
            items={[
              { key: "one", label: "Order found", done: true },
              { key: "two", label: "Photo of damaged item", done: false },
            ]}
          />
        </Card>
        <Timeline events={events} />
        <Card>
          <p className="mb-4 text-lg font-semibold">Feedback states</p>
          <div className="space-y-4">
            <ErrorBanner
              message="The request could not load. Check your connection and try again."
              onRetry={() => setToast("Retry started")}
            />
            <ErrorBanner message="This action is currently unavailable." />
            <EmptyState
              title="Nothing here yet"
              description="New items will appear here."
            />
            <EmptyState
              title="No requests yet"
              description="Start a request when you need support."
              action={<Button>Start request</Button>}
            />
            <Button
              variant="secondary"
              onClick={() => setToast("Changes saved.")}
            >
              Show toast
            </Button>
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Show dialog
            </Button>
          </div>
        </Card>
      </div>
      <Dialog
        open={dialogOpen}
        title="Example dialog"
        description="Dialogs keep focused actions clear and accessible."
        onClose={() => setDialogOpen(false)}
        actions={<Button onClick={() => setDialogOpen(false)}>Done</Button>}
      />
      <Toast message={toast} onClose={() => setToast("")} />
    </>
  )
}
