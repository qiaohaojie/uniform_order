# UniformOrder Order Fulfilment Workflow — Design Specification

## 1. Purpose

This specification defines the revised order fulfilment workflow for the UniformOrder school uniform shop admin system.

The goal is to simplify day-to-day operations for small NSW school uniform shops, especially P&C-operated shops with one or two staff or volunteers, while still supporting a more complete workflow for schools that need ready-for-pickup notifications, issue handling, refunds, and future shipping support.

The fulfilment board should track what shop staff need to do operationally. Payment state, refund state, notification state, and shipping availability should be modelled separately from fulfilment status.

---

# 2. Core Design Principles

## 2.1 Separate payment, fulfilment, notification, and refund state

Do not overload one `status` field to mean everything.

Conceptually separate:

```ts
payment_status
fulfilment_status
notification_state
refund_state / refund records
fulfilment_method
workflow_mode
```

Example:

```text
Fulfilment: Completed
Payment: Partially refunded
Completion type: Collected
```

This is valid and should not be treated as inconsistent.

---

## 2.2 Board columns represent operational stages only

The board is for shop staff.

Columns should answer:

> “What does the shop need to do next?”

They should not be used for payment, email, or refund lifecycle.

---

## 2.3 Badges and mini-labels represent metadata

Examples of metadata:

```text
Paid
Printed
Email sent
Email failed
Collected
Shipped
Refunded
Partially refunded
```

These should appear as card badges or labels, not as board columns.

---

## 2.4 Avoid unnecessary staff clicks

The system should not require staff to move every order through unnecessary intermediate stages such as `Packing`.

For small shops, staff may either:

1. print pick slips and update orders later, or
2. use a mobile-optimised picking mode and update orders in real time.

Both workflows should be supported.

---

# 3. Tenant-Level Feature Flags / Settings

These settings are tenant-specific and must be database-driven. They should not be stored in `.env`.

`.env` is appropriate for global environment settings only. These workflow settings vary by school, so they belong in tenant configuration.

## 3.1 Recommended table: `tenant_settings`

One row per school / tenant.

```ts
tenant_settings -
  tenant_id -
  workflow_mode - // "standard" | "simple"
  pickup_enabled - // boolean
  shipping_enabled - // boolean
  created_at -
  updated_at -
  updated_by;
```

Recommended MVP defaults:

```ts
workflow_mode = "standard";
pickup_enabled = true;
shipping_enabled = false;
```

## 3.2 Recommended audit table: `tenant_setting_events`

Because these settings affect fulfilment behaviour, all changes should be audited.

```ts
tenant_setting_events -
  id -
  tenant_id -
  setting_key - // "workflow_mode", "shipping_enabled", etc.
  old_value -
  new_value -
  changed_by_admin_id -
  reason -
  created_at;
```

Example event:

```text
setting_key: workflow_mode
old_value: standard
new_value: simple
reason: School requested simplified two-column workflow due to low order volume.
```

---

# 4. Feature Flag: Shipping Availability

## 4.1 Purpose

Shipping/delivery by post should exist in the codebase but be hidden for MVP1 unless enabled for a specific school.

Most P&C shops will initially operate as pickup-only.

## 4.2 Setting

```ts
shipping_enabled: boolean;
```

For MVP1:

```ts
shipping_enabled = false;
```

## 4.3 Behaviour when shipping is disabled

The UI must:

```text
- Hide shipping option during checkout
- Hide shipping-specific admin actions
- Hide shipped-specific board labels where irrelevant
- Treat completed pickup orders as collected/manual completion
```

The backend must also enforce the setting.

Do not rely only on frontend hiding.

Example guard:

```ts
if (!tenantSettings.shipping_enabled && fulfilmentMethod === "shipping") {
  throw new Error("Shipping is not enabled for this school");
}
```

## 4.4 Future behaviour when shipping is enabled

When enabled later, the system can support:

```text
Pickup
Shipping
```

In that case, completed orders may show:

```text
Completed / Collected
Completed / Shipped
```

For MVP1, shipping should remain hidden.

---

# 5. Feature Flag: Workflow Mode

## 5.1 Purpose

Support two fulfilment board modes:

```ts
workflow_mode = "standard" | "simple";
```

Default should be:

```ts
workflow_mode = "standard";
```

## 5.2 Admin-only setting

Schools should not be able to switch this setting themselves.

This should be controlled by platform/admin tooling only.

Rationale:

```text
- Switching modes changes workflow semantics.
- It affects status display.
- It affects notification expectations.
- It can confuse staff if toggled casually.
```

## 5.3 Standard Mode

Standard Mode is the default and recommended workflow.

Columns:

```text
To prepare
Ready
Needs attention
Completed
```

Use this mode for schools that want proper order readiness tracking and parent notifications.

## 5.4 Simple Mode

Simple Mode is a hidden/admin-enabled accommodation for low-volume schools.

Columns:

```text
To prepare
Completed
```

Simple Mode should not be heavily marketed. It should be offered only when a school finds Standard Mode too much overhead.

In Simple Mode:

```text
- No Ready column
- No Needs attention column
- No notification sub-statuses in the board workflow
- No collected/shipped distinction in the board columns
- Staff manually mark orders from To prepare to Completed
```

However, important financial badges such as `Refunded` or `Partially refunded` should still be visible because they matter for reconciliation.

---

# 6. Workflow Mode Display Mapping

Switching Standard Mode to Simple Mode should not destructively rewrite historical status data.

Instead, Simple Mode should collapse the display.

## 6.1 Display mapping

```ts
function getDisplayStatus(order, workflowMode) {
  if (workflowMode === "simple") {
    return order.fulfilment_status === "completed" ? "completed" : "to_prepare";
  }

  return order.fulfilment_status;
}
```

Therefore:

```text
Standard status        Simple display
-------------------------------------
to_prepare            To prepare
ready                 To prepare
needs_attention       To prepare
completed             Completed
```

## 6.2 No automatic emails during mode switch

Changing workflow mode must not send emails.

## 6.3 Preserve audit history

Do not delete existing status events.

If a school later needs investigation, previous workflow events should remain available in the audit/event log.

---

# 7. Standard Mode Board Design

## 7.1 Columns

The Standard Mode board should have four columns:

```text
To prepare
Ready
Needs attention
Completed
```

## 7.2 Column meanings

### To prepare

Orders that have been paid and now need staff action.

Only paid orders should appear on the board.

Unpaid or abandoned checkouts should not enter the fulfilment board.

### Ready

Orders physically ready for pickup.

When an order is moved to Ready, the system normally sends a ready-for-pickup email.

### Needs attention

Orders with an operational issue that prevents normal completion.

Examples:

```text
- Out of stock
- Wrong size unavailable
- Damaged item
- Parent confirmation needed
- Staff needs to investigate
```

This is primarily an internal operational state. It does not automatically mean the parent must be emailed.

### Completed

Orders whose original fulfilment task is finished.

For MVP1 pickup-only:

```text
Completed usually means collected/manual completion.
```

Future completion subtypes:

```text
Collected
Shipped
Manual
```

Refunded orders can still remain Completed.

---

# 8. Simple Mode Board Design

## 8.1 Columns

```text
To prepare
Completed
```

## 8.2 Behaviour

Simple Mode is intentionally minimal.

Staff workflow:

```text
Order appears in To prepare
Staff handles the order manually
Staff marks Completed
```

No Ready stage.
No Needs attention stage.
No automatic ready-for-pickup lifecycle.
No issue workflow.

## 8.3 Refund badges still shown

Even in Simple Mode, completed cards should show refund/payment badges where applicable:

```text
Refunded
Partially refunded
```

Reason:

Refund state affects reconciliation and should remain visible.

---

# 9. Mobile Pick Mode

## 9.1 Purpose

Mobile staff workflow should not use drag-and-drop Kanban.

A Kanban board is useful on desktop, but on mobile it is awkward for physical picking.

Instead, implement a mobile-optimised picking mode.

## 9.2 Standard Mode mobile actions

Mobile cards should present clear action buttons:

```text
Mark ready
Report issue
Mark collected / Complete
```

For MVP1 pickup-only, this can be:

```text
Mark ready
Report issue
Mark completed
```

## 9.3 Simple Mode mobile actions

In Simple Mode:

```text
Mark completed
```

No Ready or Issue actions should appear.

## 9.4 Print remains supported

Staff should still be able to print pick slips.

Printing is a fallback and familiar workflow for staff or volunteers.

## 9.5 QR code deferred

QR codes on pick slips are a possible future enhancement, but not required for MVP.

Do not implement QR-based scanning now.

---

# 10. Pick Slip Behaviour

## 10.1 Printing should not change fulfilment status

Printing pick slips is an event, not a workflow state.

Do not move an order from `To prepare` to another status just because it was printed.

## 10.2 Recommended fields

```ts
pick_slip_printed_at;
pick_slip_batch_id;
pick_slip_printed_by;
```

## 10.3 UI badge

If an order has been printed, the card may show:

```text
Printed
```

But this should be metadata only.

---

# 11. Status Transition Rules — Standard Mode

## 11.1 Core transitions

| Trigger                       | Transition                   | Notes                                                                 |
| ----------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| Parent pays online            | Not on board → To prepare    | Only paid orders enter the staff board                                |
| Staff prints pick slip        | No status change             | Add Printed badge/event only                                          |
| Staff marks ready             | To prepare → Ready           | Triggers ready email                                                  |
| Staff reports issue           | To prepare → Needs attention | Usually internal only; email depends on parent impact                 |
| Staff finds issue after ready | Ready → Needs attention      | Usually requires hold/correction email if parent was already notified |
| Issue resolved                | Needs attention → Ready      | Triggers ready email                                                  |
| Parent collects order         | Ready → Completed            | No extra email required by default                                    |
| Staff marks complete manually | Any active state → Completed | Should be allowed where appropriate                                   |
| Refund processed              | No fulfilment transition     | Payment/refund state changes only                                     |

## 11.2 Disallowed normal transitions

Do not support normal staff drag/drop or standard actions for:

```text
Completed → Ready
Completed → Needs attention
Completed → To prepare
```

Completed should mean the original fulfilment task is closed.

## 11.3 Admin correction / reopen

Mistakes can happen.

Support a restricted action:

```text
Reopen order
```

This should not be normal Kanban movement.

Recommended behaviour:

```text
Completed → To prepare
```

Requirements:

```text
- Hidden behind overflow/admin action
- Requires confirmation
- Requires reason
- Creates audit event
- Does not automatically email parent
```

Example audit reason:

```text
Marked completed by mistake; order was not collected.
```

---

# 12. Status Transition Rules — Simple Mode

## 12.1 Core transitions

| Trigger               | Transition                | Notes                             |
| --------------------- | ------------------------- | --------------------------------- |
| Parent pays online    | Not on board → To prepare | Only paid orders enter board      |
| Staff marks completed | To prepare → Completed    | Manual completion                 |
| Refund processed      | No fulfilment transition  | Payment/refund state changes only |

## 12.2 Collapsed active statuses

If the underlying order has one of these statuses:

```text
to_prepare
ready
needs_attention
```

Simple Mode displays it as:

```text
To prepare
```

## 12.3 Reopen correction

Same as Standard Mode:

```text
Completed → To prepare
```

Only as restricted correction action with reason and audit log.

---

# 13. Email Notification Rules

## 13.1 Guiding principle

Emails should be sent only when the parent’s behaviour or expectations need to change.

The board is for staff workflow. Emails are customer communication events.

## 13.2 Payment confirmation

Payment/order confirmation is separate from fulfilment workflow.

When parent pays:

```text
Order enters To prepare
Payment/order confirmation may be sent by existing checkout/payment flow
No ready-for-pickup email yet
```

## 13.3 Ready email

When staff marks an order Ready:

```text
To prepare → Ready
```

Send:

```text
Your order is ready for pickup.
```

Card should show:

```text
Email sent
```

If sending is pending:

```text
Sending...
```

If sending fails:

```text
Email failed
Retry
```

## 13.4 Issue email

`Needs attention` should not always send an email.

### Case A — issue found before parent was told to come

```text
To prepare → Needs attention
```

Default:

```text
No parent email
```

Reason:

The issue may be internal, temporary, or resolvable without changing parent behaviour.

Examples:

```text
- Staff needs to find stock
- Supplier delay is minor
- Size issue might be resolved internally
```

However, staff should be able to choose to notify parent if needed.

### Case B — issue found after Ready email was sent

```text
Ready → Needs attention
```

Default:

```text
Send hold/correction email
```

Reason:

The parent may already be planning to come. They need to know not to come yet.

Suggested message:

```text
Please hold off on pickup. We found an issue with your order and will notify you once it is ready.
```

Card label:

```text
Hold notice sent
```

### Case C — parent action required

If the issue requires parent input, send issue email.

Examples:

```text
- Choose alternative size
- Approve substitution
- Confirm delayed item
```

### Case D — issue resolved

```text
Needs attention → Ready
```

Send ready email.

If a hold/correction email was previously sent, this is the “now ready” follow-up.

## 13.5 Refund email

Refund emails should be sent only after a successful refund.

Rules:

```text
- Open refund modal: no email
- Refund succeeds: send refund confirmation email
- Refund fails: no parent email; show staff error
- Webhook detects out-of-band refund: reconcile payment state and avoid duplicate emails
```

Partial refund email should include amount refunded.

Full refund email should clearly state the order/payment has been refunded.

## 13.6 Avoid duplicate emails

The system should track notification events.

Recommended fields or events:

```ts
ready_email_sent_at;
hold_email_sent_at;
refund_email_sent_at;
last_notification_type;
notification_events;
```

Better long-term approach:

```ts
order_notification_events -
  id -
  order_id -
  tenant_id -
  type - // "ready", "hold", "refund", "shipping", etc.
  status - // "queued", "sent", "failed"
  provider_message_id -
  sent_at -
  failed_at -
  failure_reason -
  created_at;
```

## 13.7 Optional safety delay

Recommended but not mandatory:

After staff marks Ready, queue the email briefly.

Example UI:

```text
Marked ready. Email sending in 60 seconds. Undo
```

This reduces accidental ready emails.

---

# 14. Refund Design

## 14.1 Existing implementation assumption

Based on the reported code summary, refund logic already exists and is production-capable:

```ts
stripe.refunds.create(
  {
    payment_intent: order.stripePaymentIntentId,
    amount: amountCents,
    reverse_transfer: true,
    refund_application_fee: true,
    reason: toStripeReason(body.reason),
  },
  { idempotencyKey },
);
```

Existing behaviour reportedly includes:

```text
- Real Stripe refund call
- Stripe Connect reverse transfer
- Platform fee refund
- Idempotency key
- Rate limiting
- orderRefunds table
- Webhook reconciliation via charge.refunded
- Support for partial and full refund status
```

## 14.2 Refund is payment state, not fulfilment state

Do not move the order out of Completed when refunding.

Correct model:

```text
Fulfilment status: Completed
Payment status: Refunded
```

or:

```text
Fulfilment status: Completed
Payment status: Partially refunded
```

## 14.3 Completed orders can be refunded

Staff should be able to refund completed orders.

Example workflow:

```text
Order completed / collected
Parent later requests refund
Staff opens order detail
Staff clicks Refund
Staff confirms
Stripe refund succeeds
Payment status updates to refunded / partially_refunded
Order remains Completed
Refund email sent
```

## 14.4 Refund warning

Refund action must show a serious confirmation.

Suggested copy:

```text
Refund $45.00 to parent?

This will return money to the parent's card and cannot be undone from this order. To charge again, the parent will need to place a new order.
```

## 14.5 Refund card display

In Standard Mode Completed column:

```text
Completed
Collected
Refunded
```

or:

```text
Completed
Collected
Partially refunded: $25.00
```

In Simple Mode Completed column:

```text
Completed
Refunded
```

or:

```text
Completed
Partially refunded
```

## 14.6 Refund reports

Reports should separate gross, refund, and net amounts.

Recommended reporting fields:

```text
Gross sales
Refund amount
Net sales
Payment status
Fulfilment status
Refund reason
Refund timestamp
```

Example:

```text
Order #123
Fulfilment: Completed
Payment: Partially refunded
Gross: $120.00
Refunded: $20.00
Net: $100.00
```

A completed-but-refunded order is not a discrepancy. It is a valid business event.

---

# 15. Data Model Recommendation

## 15.1 Orders table fields

Recommended conceptual fields:

```ts
orders -
  id -
  tenant_id -
  fulfilment_status - // "to_prepare" | "ready" | "needs_attention" | "completed"
  fulfilment_method - // "pickup" | "shipping"
  completion_type - // "collected" | "shipped" | "manual" | null
  payment_status - // "paid" | "partially_refunded" | "refunded"
  total_cents -
  refunded_amount_cents -
  ready_at -
  completed_at -
  created_at -
  updated_at;
```

For MVP1:

```ts
fulfilment_method = "pickup";
shipping_enabled = false;
```

## 15.2 Order events table

Use an event log for workflow history.

```ts
order_events -
  id -
  order_id -
  tenant_id -
  event_type -
  from_status -
  to_status -
  actor_id -
  reason -
  metadata_json -
  created_at;
```

Example event types:

```text
order_paid
pick_slip_printed
status_changed
ready_email_sent
hold_email_sent
refund_created
refund_failed
order_reopened
```

## 15.3 Refund records

Already reportedly exists as `orderRefunds`.

Expected fields:

```ts
order_refunds -
  id -
  order_id -
  tenant_id -
  stripe_refund_id -
  amount_cents -
  reason -
  operator_id -
  created_at;
```

## 15.4 Tenant settings

```ts
tenant_settings -
  tenant_id -
  workflow_mode -
  pickup_enabled -
  shipping_enabled -
  updated_at -
  updated_by;
```

## 15.5 Tenant setting events

```ts
tenant_setting_events -
  id -
  tenant_id -
  setting_key -
  old_value -
  new_value -
  changed_by_admin_id -
  reason -
  created_at;
```

---

# 16. UI Requirements

## 16.1 Desktop board — Standard Mode

Show four columns:

```text
To prepare
Ready
Needs attention
Completed
```

Card should show:

```text
Order number
Student / parent name
Items summary
Amount
Paid badge
Printed badge if applicable
Email status if applicable
Refund badge if applicable
Completion subtype if applicable
```

## 16.2 Desktop board — Simple Mode

Show two columns:

```text
To prepare
Completed
```

Card should show:

```text
Order number
Student / parent name
Items summary
Amount
Paid badge
Refund badge if applicable
```

Do not show Ready/Issue sub-status workflow labels.

## 16.3 Mobile pick mode

Mobile should use a list/action interface, not drag-and-drop.

Standard Mode actions:

```text
Mark ready
Report issue
Mark completed
```

Simple Mode actions:

```text
Mark completed
```

## 16.4 Order detail page actions

Actions depend on order state and tenant mode.

Recommended actions:

### Active order

```text
Print pick slip
Mark ready
Report issue
Mark completed
Refund, if payment allows
```

### Completed order

```text
Refund
Reopen order, restricted/admin correction only
View history
```

### Refunded order

```text
View refund details
No further refund if fully refunded
Partial refund only if amount remains refundable
```

---

# 17. Backend Enforcement Requirements

## 17.1 Shipping enforcement

Backend must reject shipping when disabled.

```ts
if (!tenantSettings.shipping_enabled && fulfilmentMethod === "shipping") {
  throw new Error("Shipping disabled for tenant");
}
```

## 17.2 Workflow mode enforcement

Backend should determine allowed actions based on `workflow_mode`.

In Simple Mode, reject unsupported workflow actions such as:

```text
mark_ready
report_issue
```

unless explicitly supported internally.

## 17.3 Completed order reversal

Normal staff workflow should not allow:

```text
completed → ready
completed → needs_attention
```

Only allow restricted correction:

```text
reopen_order
```

with required reason and audit event.

## 17.4 Refund enforcement

Refund should:

```text
- Verify refundable amount
- Confirm payment status allows refund
- Use Stripe refund endpoint
- Use idempotency key
- Record refund event
- Update payment_status
- Trigger refund email after success
```

Do not change fulfilment status during refund.

---

# 18. Implementation Acceptance Criteria

## 18.1 Standard Mode

Given a tenant has:

```ts
workflow_mode = "standard";
shipping_enabled = false;
```

Then:

```text
- Admin board shows To prepare, Ready, Needs attention, Completed
- Checkout shows pickup only
- Staff can mark To prepare → Ready
- Ready transition sends ready email
- Staff can move Ready → Needs attention with hold notice if ready email already sent
- Staff can move Needs attention → Ready and send ready email
- Completed orders remain completed even if refunded
```

## 18.2 Simple Mode

Given a tenant has:

```ts
workflow_mode = "simple";
shipping_enabled = false;
```

Then:

```text
- Admin board shows only To prepare and Completed
- Any non-completed order appears under To prepare
- Completed orders appear under Completed
- Staff can mark To prepare → Completed
- Ready and Needs attention workflow controls are hidden
- Refund badges still appear
```

## 18.3 Shipping disabled

Given:

```ts
shipping_enabled = false;
```

Then:

```text
- Checkout does not show shipping
- Backend rejects shipping orders
- Admin UI does not show shipping actions
```

## 18.4 Refund

Given a completed paid order:

```text
- Staff can open refund modal
- Staff confirms refund
- Stripe refund is created
- orderRefunds record is created
- payment_status becomes refunded or partially_refunded
- fulfilment_status remains completed
- refund email is sent after success
- card shows Refunded or Partially refunded
```

## 18.5 Reopen correction

Given a completed order was marked complete by mistake:

```text
- Staff/admin can use restricted Reopen order action
- Reason is required
- Order moves to To prepare
- Audit event is created
- No automatic parent email is sent
```

---

# 19. Out of Scope for MVP1

The following should not be implemented in MVP1 unless already present and safe:

```text
- QR code pick slip scanning
- Full shipping workflow
- Tracking numbers
- Customer self-service exchanges
- After-sales ticket/case management
- School self-service workflow mode switching
- Completed → Ready / Issue as normal workflow
```

Refund support is in scope because it already exists and should be integrated cleanly into the board/payment state model.

---

# 20. Final Recommended MVP1 Configuration

For most schools at launch:

```ts
workflow_mode = "standard";
pickup_enabled = true;
shipping_enabled = false;
```

Default board:

```text
To prepare
Ready
Needs attention
Completed
```

Optional admin-only configuration for low-volume schools:

```ts
workflow_mode = "simple";
pickup_enabled = true;
shipping_enabled = false;
```

Simple board:

```text
To prepare
Completed
```

Refunds:

```text
Handled on order detail page
Do not alter fulfilment status
Show refund badge/payment status
Send refund email after successful refund
```

Shipping:

```text
Code may remain
UI hidden
Backend disabled unless tenant flag enables it
```

---

# 21. Summary

The final design separates fulfilment workflow from payment, notification, refund, and shipping concerns. Standard Mode provides a proper operational board for most schools: **To prepare → Ready → Needs attention → Completed**. Simple Mode provides an admin-enabled two-column board for low-volume schools: **To prepare → Completed**. Shipping is hidden behind a tenant-level setting for MVP1. Refunds remain payment events, not fulfilment transitions, so an order can be completed and refunded at the same time. Emails are sent only when parent expectations need to change: ready for pickup, hold/correction notices, shipping updates, and refund confirmations.
