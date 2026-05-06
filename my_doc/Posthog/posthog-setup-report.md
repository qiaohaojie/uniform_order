# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into UniformOrder. The integration covers the full parent purchase journey (item discovery → cart → checkout → payment → order confirmation), admin operator fulfillment actions, and user identity linking. Both client-side and server-side events are instrumented so behaviours from the browser and the API layer are fully correlated.

**Environment variables** were written to `apps/web/.env.local`:
- `NEXT_PUBLIC_POSTHOG_KEY` — public token for posthog-js (browser)
- `NEXT_PUBLIC_POSTHOG_HOST` — PostHog ingest host for posthog-js
- `POSTHOG_HOST` — host used by the server-side `posthog-node` client

**User identification** was added to `posthog-provider.tsx` using the NeonDB Auth `useSession` hook. When a session is loaded, `posthog.identify()` is called with the user's ID, email, and name. When the user signs out, `posthog.reset()` is called to unlink future anonymous events from the old profile.

---

## Events instrumented

| Event | Description | File |
|---|---|---|
| `item_added_to_cart` | Parent adds an item from the item detail page — top of the purchase funnel | `apps/web/src/app/[tenant]/item/[itemId]/interactive.tsx` |
| `checkout_started` | Parent clicks Checkout from the cart page | `apps/web/src/app/[tenant]/cart/cart-screen.tsx` |
| `delivery_method_selected` | Parent selects pickup or ship-to-home during checkout | `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` |
| `payment_attempted` | Parent clicks Pay — start of payment processing | `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` |
| `payment_failed` | Stripe or network returns an error during checkout | `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` |
| `order_placed` *(server)* | Order record created in DB after payment confirmed | `apps/web/src/app/api/orders/route.ts` |
| `order_confirmed` *(server)* | Stripe webhook flips order status to `new` after `payment_intent.succeeded` | `apps/web/src/app/api/stripe/webhook/route.ts` |
| `refund_issued` *(server)* | Operator successfully issues a Stripe refund | `apps/web/src/app/api/orders/[orderId]/refund/route.ts` |
| `order_status_advanced` | Admin advances an order through the fulfilment workflow | `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx` |
| `order_ready_notification_sent` | Admin clicks "Notify parent" for a ready order | `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx` |

---

## Next steps

We've built a dashboard and five insights for you to monitor user behaviour from day one:

**Dashboard:** https://us.posthog.com/project/411893/dashboard/1550233

| Insight | URL |
|---|---|
| Purchase conversion funnel | https://us.posthog.com/project/411893/insights/24cUnnPc |
| Order volume (daily) | https://us.posthog.com/project/411893/insights/ll0mNUwA |
| Payment failure rate | https://us.posthog.com/project/411893/insights/tKLNGon2 |
| Delivery method breakdown | https://us.posthog.com/project/411893/insights/Jvhx76H2 |
| Refunds issued | https://us.posthog.com/project/411893/insights/gNO0kFAY |

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
