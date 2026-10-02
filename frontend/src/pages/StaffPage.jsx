import { EmptyState } from "../components/ui"
import { PageHeader } from "../components/shared"

export default function StaffPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Review and manage customer support requests."
      />
      <EmptyState
        title="Staff dashboard coming soon"
        description="Customer request tools are ready. Staff review tools are a placeholder in this demo."
      />
    </>
  )
}
