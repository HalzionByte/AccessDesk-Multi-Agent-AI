export const orders = [
  {
    id: "NF-10482",
    product: "Orbit Wireless Headphones",
    purchasedAt: "2026-02-18",
  },
  {
    id: "NF-10319",
    product: "Arc Mini Bluetooth Speaker",
    purchasedAt: "2026-01-29",
  },
]

const checklist = (complete) => [
  { key: "order", label: "Order found", done: true },
  { key: "issue", label: "Issue type", done: complete },
  { key: "description", label: "Description (10+ characters)", done: complete },
  { key: "photo", label: "Photo of damaged item", done: complete },
  { key: "resolution", label: "Requested resolution", done: complete },
]

const baseEvents = [
  {
    actor: "intake",
    action: "Intake Agent collected order details",
    outcome: "Order NF-10482 found",
    at: "2026-02-20T10:01:00Z",
  },
  {
    actor: "policy",
    action: "Policy Agent retrieved replacement requirements",
    outcome: "Policy P-3 checked",
    at: "2026-02-20T10:02:00Z",
  },
  {
    actor: "resolution",
    action: "Resolution Agent found no existing case",
    outcome: "Ready for confirmation",
    at: "2026-02-20T10:03:00Z",
  },
]

const completePreview = {
  orderId: "NF-10482",
  product: "Orbit Wireless Headphones",
  issue: "Damaged on arrival",
  statement: "The left ear cup is cracked and the headband is bent.",
  attachments: ["damage-front.jpg"],
  resolution: "Replacement",
  summary: "Headphones arrived with physical damage.",
  window: "Within 7-day window",
}

export const chatResponses = {
  complete: {
    draftId: "draft-s1-complete",
    stage: "confirm",
    reply:
      "I found your order and have enough information to prepare the request. Review the details before you submit.",
    language: "en",
    fields: {
      orderId: "NF-10482",
      issue: "Damaged on arrival",
      statement: completePreview.statement,
      resolution: "Replacement",
    },
    checklist: checklist(true),
    citations: [
      {
        id: "P-3",
        title: "Damaged item policy",
        text: "Report delivery damage within 7 days. Add a clear photo and your preferred resolution.",
      },
    ],
    preview: completePreview,
    existingCase: null,
    events: baseEvents,
  },
  incomplete: {
    draftId: "draft-s1-incomplete",
    stage: "collect",
    reply:
      "I found the order. Please describe the damage in at least 10 characters, add a photo, and tell me if you prefer a replacement or refund.",
    language: "en",
    fields: { orderId: "NF-10482", issue: "", statement: "", resolution: "" },
    checklist: checklist(false),
    citations: [
      {
        id: "P-3",
        title: "Damaged item policy",
        text: "Report delivery damage within 7 days. Add a clear photo and your preferred resolution.",
      },
    ],
    preview: null,
    existingCase: null,
    events: baseEvents.slice(0, 2),
  },
  repeat: {
    draftId: "draft-s3-repeat",
    stage: "existing_case",
    reply:
      "There is already a case for this order and issue. You can follow it using the tracking number below.",
    language: "en",
    fields: { orderId: "NF-10482", issue: "Damaged on arrival" },
    checklist: checklist(true),
    citations: [],
    preview: null,
    existingCase: {
      caseId: "case-1000",
      trackingNo: "AD-2026-0008",
      status: "Under Review",
    },
    events: [
      baseEvents[0],
      {
        actor: "resolution",
        action: "Resolution Agent found an existing case",
        outcome: "No duplicate case created",
        at: "2026-02-20T10:03:00Z",
      },
    ],
  },
  late: {
    draftId: "draft-s4-late",
    stage: "confirm",
    reply:
      "This order is past the 7-day window. You can still submit the request for staff review. Approval is not guaranteed.",
    language: "en",
    fields: {
      orderId: "NF-10319",
      issue: "Damaged on arrival",
      statement: "The speaker casing is split near the charging port.",
      resolution: "Replacement",
    },
    checklist: checklist(true),
    citations: [
      {
        id: "P-3",
        title: "Damaged item policy",
        text: "Damage requests submitted after 7 days require staff review. Approval is not guaranteed.",
      },
    ],
    preview: {
      ...completePreview,
      orderId: "NF-10319",
      product: "Arc Mini Bluetooth Speaker",
      statement: "The speaker casing is split near the charging port.",
      attachments: ["speaker-damage.png"],
      window: "Past 7-day window",
    },
    existingCase: null,
    events: baseEvents,
  },
}

export const cases = [
  {
    id: "case-1000",
    trackingNo: "AD-2026-0008",
    orderId: "NF-10482",
    product: "Orbit Wireless Headphones",
    issue: "Damaged on arrival",
    summary: "Left ear cup cracked during delivery.",
    statement: "The left ear cup is cracked and the headband is bent.",
    evidence: ["damage-front.jpg"],
    resolution: "Replacement",
    submittedAt: "20 February 2026",
    status: "Under Review",
  },
  {
    id: "case-1001",
    trackingNo: "AD-2026-0005",
    orderId: "NF-10319",
    product: "Arc Mini Bluetooth Speaker",
    issue: "Damaged on arrival",
    summary: "Speaker casing split near charging port.",
    statement: "The speaker casing is split near the charging port.",
    evidence: ["speaker-damage.png"],
    resolution: "Replacement",
    submittedAt: "12 February 2026",
    status: "Needs Information",
    staffRequest: "Please send a photo showing the full product and packaging.",
  },
]
