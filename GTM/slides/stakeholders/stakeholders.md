# UniformOrder — Sales Deck Blueprint: **Stakeholders**

> **Purpose of this document.** This is a slide-by-slide brief for generating a deck aimed at *stakeholders* in the UniformOrder business: prospective investors, advisors, channel partners (school associations, P&C federations, education suppliers), pilot-school board members, and potential strategic partners. It is **not** a customer pitch — the goal is to convey the business case, traction, and credibility of the team behind the product.
>
> Hand this file to a slide-generation tool and it will have everything it needs. Do not generate the actual slides from this file unless asked.

---

## 0. Context the slide generator must internalise

**The product (one line).** A multi-tenant SaaS platform that digitises Australian school uniform shops, using Stripe Connect so each school remains the seller of record and the platform never holds funds.

**The audience.** Sophisticated commercial readers who will judge the business on three axes:
1. **Is the problem real and large enough?** (Market sizing + pain credibility)
2. **Is the product defensible?** (Compliance moat, switching cost, distribution)
3. **Can this team execute?** (Engineering signal, capital efficiency, customer evidence)

**Stages of conversation this deck supports.**
- Cold introduction over email — the deck is the attachment.
- 30-minute first call — the deck is the agenda.
- Follow-up after a verbal yes — the deck is the artefact circulated internally.

**What stakeholders need to feel by the end.**
1. The Australian school-uniform market is structurally inefficient and addressable.
2. The team has shipped real, working software with real compliance posture — not a demo.
3. The economics work: take-rate via Stripe Connect, low fixed cost per tenant, multi-school operator model on the roadmap.
4. There is a credible path from pilot revenue to a category-defining position.

**What we are not.** We are not a Series A growth story. We are not a content platform with payments. We are not asking for permission to compete with Square or Shopify — we are addressing a vertical neither of them addresses well.

---

## 1. Tone and copy rules

- **Plain, confident, evidence-led.** Each claim sits adjacent to a data point or a labelled positioning statement. No hand-waving.
- **No hype words.** Same exclusion list as the schools deck (see `../schools/BLUEPRINT.md` § 1). Add to that list, for this audience: *revolutionise, disrupt, 10x, category leader, world-class, AI-native.*
- **Numerals where they help.** GST rates as `1/11`. AUD with `$`. Percentages with `%`. Time-saved figures explicitly labelled as "in pilot" or "to validate" when the n is small.
- **Honesty over polish.** A 🚧 roadmap label is more credible to this audience than a glossed-over claim.
- **Australian English** consistent with the rest of the GTM corpus.
- **Sentence case** for slide titles. No subtitles unless they add information.

**Words to use:** tenant, take-rate, fulfilment, AU-resident data, seller of record, compliance posture, defensibility, roadmap, pilot, ACV, GMV, churn surface.

**Words to avoid:** revolutionise, disrupt, transform, frictionless, magical, AI-driven, world-class, best-in-class, leader, pioneer.

---

## 2. Visual design direction

Echo the customer-facing deck for continuity, but with a slightly more editorial feel — this deck will be read on a laptop, not projected.

| Token | Hex | Used for |
|---|---|---|
| Navy deep | `#081A2D` | Cover, section dividers, data-emphasis backgrounds |
| Parchment | `#FAF6EE` | Body slide background |
| Paper | `#FDFBF6` | Inset cards |
| Rule | `#E5DFD2` | Hairlines |
| Gold | `#B08A3E` | One accent per slide; reserved for headline numerals |

**Typography.** Newsreader for headlines, slightly smaller than the customer deck (~44pt) to make room for denser body slides. Inter for body. Inter Mono permitted for code-or-data callouts (e.g. table columns) where the deck shows technical artefacts.

**Layout principles.**
- Two-column layouts are encouraged. Body slides may be data-dense.
- Charts are flat, two-colour, no 3D, no gradients. Use navy for the primary series, gold for the highlighted series.
- Tables: hairline rules in `--color-rule`, tabular-numerals Inter, generous row height.
- Section dividers are full-bleed navy with parchment text, identical to the schools deck for visual continuity.
- Every slide carries a 9pt footer with a source citation if any figure on the slide is sourced externally.

---

## 3. Deck structure (18 core slides + 4 appendix)

```
Cover                              (1)
Section A — Problem & market       (2-5)
Section B — Product & how it works (6-10)
Section C — Why us, why now        (11-14)
Section D — Business model         (15-17)
Section E — The ask                (18)
Appendix                           (A1-A4)
```

Total runtime when presented: ~25 minutes. Designed to be read silently in ~9 minutes.

---

## 4. Slide-by-slide

### Slide 1 — Cover

- **Headline (Newsreader 60pt):** *UniformOrder.*
- **Sub-headline (Inter 22pt):** Digitising the Australian school uniform shop.
- **Layout:** Full-bleed parchment. Headline top-left. Sub-headline directly below, gold rule between. Footer in 11pt: [Presenter Name] · [Month Year] · uniformorder.online.
- **Speaker note:** Do not put a logo wall, advisor list, or social proof on the cover. The cover is intentionally restrained.

### Slide 2 — Section divider: "Problem & market"

- **Title:** Problem & market
- **Sub-title:** A category every school operates in. None operate it well.

### Slide 3 — The category

- **Headline:** Every Australian school runs a uniform shop. Almost none run it digitally.
- **Layout:** Two-column.
  - Left: three short paragraphs describing the operator (P&C volunteer, part-time staffer), the workflow (paper forms, cheques, spreadsheets), and the cost (≈20 hours per term).
  - Right: a single full-bleed image of the actual paper order form from `my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf`, with a caption: "The form most schools still use in 2026."
- **Footer:** Source: paper-form workflow analysis (own research, 2026); ≈20-hour figure is a pilot-validation target, not a measured value.

### Slide 4 — Market size and shape

- **Headline:** ~9,400 schools nationally. The addressable subset has a uniform shop and runs it themselves.
- **Layout:** Three stacked horizontal bars showing TAM → SAM → SOM.
  - **TAM (~9,400):** All Australian primary and secondary schools (ACARA, 2023).
  - **SAM (~5,500, estimated):** Schools with a uniform shop run by the school or P&C, not contracted out to a third-party retailer.
  - **SOM (Year 1 target, ~30-100):** Independent and Catholic schools in NSW and Victoria within direct reach of the founding team.
- **Footer:** TAM source: ACARA. SAM and SOM are positioning estimates, to be refined as pilots complete. ACARA figure does not break out schools by uniform-shop model — refinement is on the validation list.

### Slide 5 — Why nothing has solved this

- **Headline:** The category has been ignored because it doesn't look like a SaaS market.
- **Layout:** Three-card row.
  - **Card 1 — Spend per school is small.** A P&C does not have a software budget. Selling top-down to schools is slow.
  - **Card 2 — Integration is compliance-heavy.** Payment routing, AU data residency, seller-of-record handling, and refund policy versioning are non-trivial for a generalist platform.
  - **Card 3 — The buyer is the operator.** The decision-makers are P&C presidents and business managers, not CTOs. Distribution requires meeting them where they already gather.
- **Footer:** The combination — small ACV, high compliance bar, non-technical buyer — is why Shopify and Square skip this segment.

### Slide 6 — Section divider: "Product & how it works"

- **Title:** Product & how it works
- **Sub-title:** Two portals. One compliance posture. Three personas.

### Slide 7 — Product overview — the two portals

- **Headline:** A parent portal designed for the school-bag queue. An operator portal designed for the Monday-morning routine.
- **Layout:** Side-by-side screenshots. Left = a mobile screenshot of the parent shop with the 430px frame. Right = a desktop screenshot of the operator Kanban.
- **Body beneath each (one line):**
  - Parent: catalog, cart, checkout. Under 90 seconds end-to-end.
  - Operator: orders Kanban, catalog, refunds, reports, settings.
- **Caption row at bottom (Inter 11pt, italic):** Both screenshots are taken from the live demo environment seeded via `pnpm demo:seed`.

### Slide 8 — The technical posture

- **Headline:** Built for the compliance bar Australian schools require.
- **Layout:** Four-column grid of small cards.
  - **AU-resident data.** All tenant, parent, and order data in Neon Sydney region.
  - **PCI scope reduced.** Stripe handles card data end-to-end. UniformOrder stores only the payment intent reference.
  - **Seller of record.** Stripe Connect with destination charges. School ABN on the receipt.
  - **Audit trail.** Append-only 12-event taxonomy across orders, refunds, catalog, and sign-in.
- **Footer:** This posture is the floor, not the feature. It is the precondition for selling to a school.

### Slide 9 — What is live today

- **Headline:** What is live today, as of [Month Year].
- **Layout:** Two-column checklist using clean ✓ marks (no emoji — use a Newsreader glyph).
- **Bullets (✓ live):**
  - Multi-tenant architecture with per-school branding, accent colour, and refund policy versioning.
  - Mobile-first parent shop with magic-link sign-in.
  - Stripe Connect destination charges, gated on platform approval.
  - Operator Kanban with single-click ready, hold-with-reason, refund.
  - Reports with GST-broken-out CSV export.
  - Audit log with 12 event types, indexed by tenant and timestamp.
  - Stripe webhook handling: payment intent success, account update, charge refund.
  - Transactional email (order placed, order ready) via Resend.
- **Footer:** Each item above traces to the ✓ live rows in `GTM/product_demo/product-walkthrough.md` § 8.

### Slide 10 — What is on the near roadmap

- **Headline:** On the near roadmap.
- **Layout:** Three-column list, each item with a one-line description and a target window.
- **Items (🚧 planned / in design):**
  - **Platform console UI** — spec complete, build queued, target current sprint+1. Data model already in place.
  - **Native BAS-format export** — current export is CSV with GST. ATO-format quarterly export is v1.1.
  - **Bulk catalog CSV upload** — route exists, importer is v1.1.
  - **Multi-school operator account** — one login, many tenants. RBAC supports it; UI is v1.2.
  - **Automated data retention policy** — v1.2.
- **Footer:** Honesty calibration: nothing claimed here is shipped. Source: `GTM/product_demo/product-walkthrough.md` § 5.

### Slide 11 — Section divider: "Why us, why now"

- **Title:** Why us, why now
- **Sub-title:** The compliance bar built the moat. The team has cleared it.

### Slide 12 — Why now

- **Headline:** The shift to digital school payments happened. The uniform shop got left behind.
- **Layout:** Three short paragraphs in a single column.
  - **Para 1 — Parents are pre-trained.** School fees, excursion payments, and canteen orders moved to digital portals over the last five years. Parents pay schools through phones today. The uniform shop is the visible holdout.
  - **Para 2 — Stripe Connect is mature in AU.** Destination charges, automated payouts, AU-domiciled accounts. The infrastructure to keep the school as seller of record is now routine.
  - **Para 3 — The compliance ceiling rose.** Data residency, refund policy auditability, and append-only logs are now school-board expectations. A generalist e-commerce skin can no longer pretend.

### Slide 13 — Why us

- **Headline:** Why this team.
- **Layout:** Two-column. Left = three bullet points about the team and execution. Right = a small code-or-data callout showing one piece of evidence (e.g. a snippet of the audit log schema, a screenshot of the deployment pipeline, or a count of merged PRs).
- **Bullets (illustrative — fill with actual founder credentials):**
  - Built and shipped the production platform solo from spec to live in under 90 days.
  - AU-resident infrastructure (Neon Sydney) operational from day one.
  - Compliance posture (AU Privacy Act 1988, Australian Consumer Law refund posture, seller-of-record Stripe Connect) designed in, not retrofitted.
- **Footer:** Replace illustrative bullets with the actual founder bio + traction proof before sending to a stakeholder.

### Slide 14 — Defensibility

- **Headline:** The moat is the bar to clear, not the features above it.
- **Layout:** Single-column body, two short paragraphs.
  - **Para 1 — Compliance and trust accrue per tenant.** Every approved school adds an audit history, a Stripe Connect account, and a documented refund policy chain. None of that transfers to a competitor — and rebuilding it elsewhere costs the school more than staying.
  - **Para 2 — Distribution compounds laterally.** Schools talk to schools. A pilot school that hits Term 4 with clean reconciliation tells two neighbouring schools. The model rewards depth in a region, not breadth.

### Slide 15 — Section divider: "Business model"

- **Title:** Business model
- **Sub-title:** Take-rate per transaction. No subscription.

### Slide 16 — Unit economics

- **Headline:** Per-order platform fee, taken at the moment of payment.
- **Layout:** Worked example in a two-column table.
- **Table columns:** "Line item" and "Amount (AUD)".
- **Rows (illustrative — placeholder figures to be replaced with actual pricing before send):**
  - Average order value: $85
  - Stripe processing fee (Connect, AU): -$2.10
  - UniformOrder platform fee (placeholder): -$X.XX
  - Net to school: $YY.YY
  - Net to UniformOrder per order: $X.XX
- **Footer:** Pricing is illustrative. Actual fee BPS is finalised in `docs/pricing.md` (to be created) before this slide is filled with real numbers. Do not invent a fee figure.

### Slide 17 — Path to revenue

- **Headline:** Pilot → reference cohort → regional rollout.
- **Layout:** Four-stage horizontal timeline with quantified targets.
- **Stages:**
  1. **Pilot (current quarter):** 1–3 schools, fee waived, learn the operator workflow.
  2. **Reference cohort (next two quarters):** 10–15 schools, fee enabled, public case studies.
  3. **Regional rollout (Year 1):** 30–100 schools in NSW + VIC, channel partnership with P&C federation.
  4. **National (Year 2+):** Multi-state rollout, distribution via school-association partnerships and the multi-school operator product.
- **Footer:** Targets are positioning. Pilot revenue numbers will be inserted after the first three pilots conclude.

### Slide 18 — The ask

- **Headline:** What we are asking for.
- **Layout:** Single card on parchment. Three lines, each a sentence.
- **Lines (illustrative — replace with the actual ask before send):**
  - A 45-minute conversation about your network of school-board contacts.
  - One warm introduction to a school we are not currently in conversation with.
  - A standing 30-minute monthly check-in for the next two quarters.
- **CTA:** support@pimspace.com
- **Speaker note:** The ask varies per stakeholder type. Edit this slide before each send. The principle: ask for a small, specific, time-bound action — never "let me know what you think".

---

## 5. Appendix slides (kept hidden by default)

These are surfaced only when the conversation goes there.

### A1. Architecture one-pager

- **Headline:** Architecture, at a glance.
- **Layout:** Boxes-and-arrows diagram.
  - **Boxes:** Next.js app (Vercel-style standalone bundle on Hostinger) → Neon Postgres (Sydney) → Stripe Connect → Resend (email) → UploadThing (images) → PostHog (analytics).
- **Caption beneath:** Multi-tenant at the row level. One Postgres, one Stripe Connect platform, isolation via `tenant_id` foreign key on every relevant table. Drizzle ORM for schema migrations.
- **Footer:** Stack chosen for AU data residency (Neon Sydney) and operator-affordable hosting (Hostinger Node.js), not for resume polish.

### A2. Compliance posture detail

- **Headline:** Compliance posture, by item.
- **Layout:** Two-column table. Left = obligation. Right = how we meet it.
- **Rows:**
  - **Australian Privacy Act 1988** — Minimum PII collection; AU-resident storage; documented retention path.
  - **Australian Consumer Law (refund-policy display)** — Versioned `tenantLegalVersions` per tenant; parent acknowledgement timestamped on every order.
  - **PCI DSS** — Out of scope. All card data held by Stripe. UniformOrder stores only Stripe payment-intent ID and outcome.
  - **GST collection and reporting** — Per-order GST calculated as 1/11 of GST-inclusive amount; CSV export carries the column; native BAS export on the roadmap.
- **Footer:** Each row is currently the floor. A formal external audit is part of the post-pilot capital plan.

### A3. The competitive landscape

- **Headline:** What schools use today, and why none of them stick.
- **Layout:** Four-row table.
- **Rows:**
  - **Paper form + spreadsheet.** Default state. Loses forms, no audit, GST sums by hand.
  - **Generic e-commerce (Shopify, Squarespace).** Solves the parent payment. Does not solve the operator Kanban, the audit log, the refund policy versioning, or the GST CSV.
  - **Stripe Checkout + Google Form.** Common DIY path. Reconciliation between Stripe export and form responses is a manual weekend at month-end.
  - **Local school-software vendor.** Often bundled with school-management software at high ACV. Optimised for enrolment and fees, not the uniform shop workflow.
- **Footer:** UniformOrder positions specifically on the operator side. The parent flow is a precondition; the moat is on the back office.

### A4. Risks and how we are managing them

- **Headline:** Risks we are tracking.
- **Layout:** Three rows, each with a risk and a mitigation.
- **Rows:**
  - **Stripe Connect onboarding friction at schools.** Mitigation: a guided onboarding flow with us-on-the-call for the first cohort; documented in the demo playbook.
  - **Term-cycle seasonality (Q1 spike, Q3 trough).** Mitigation: extend the product to other intra-school sales (sports gear, formal event tickets) — same multi-tenant infrastructure, different catalog.
  - **Concentration risk on a small number of pilot schools.** Mitigation: SOM target of 30 schools by end of Year 1 across two states.

---

## 6. What to render and what to omit

The slide generator should:
- Produce a 16:9 PDF for laptop reading **and** a 4:5 social-card variant of Slide 1 for use on LinkedIn.
- Generate a speaker-notes export as Markdown.
- Include the appendix slides as hidden by default.
- Insert real numbers only where the brief explicitly says they exist. Where a number is illustrative, the placeholder must remain visible so the founder knows to replace it before sending.

The slide generator should not:
- Add a "team" slide unless the founder supplies bios — placeholder bios are worse than no team slide for this audience.
- Add a logo wall of customers we don't have yet.
- Use stock photography of stylised teachers, students, or "modern classrooms".
- Substitute a different colour palette or font. The visual identity is shared with the customer-facing decks for a reason.
- Generate any chart that interpolates or projects numbers we have not validated.

---

## 7. Honesty calibration

This is the deck where overstatement is most expensive — a stakeholder who catches a stretched claim mid-conversation costs the relationship. Read § 8 of `GTM/product_demo/product-walkthrough.md` before drafting.

The following are safe to state as fact: every ✓ live row in that table.

The following must be labelled explicitly:
- **TAM / SAM / SOM figures** — positioning estimates, not measured values.
- **~20 hours/term operator savings** — pilot-validation target.
- **Pilot revenue figures** — illustrative until first pilot reports.
- **Pricing / fee BPS** — placeholder until `docs/pricing.md` is finalised.
- **Roadmap timing windows** — best estimate at the time of drafting; deck should carry the month-year it was generated in the footer.

When this deck is regenerated, the regenerator must re-pull the claims table from `product-walkthrough.md` § 8 and refresh any ✓-vs-🚧 distinctions. The product moves. The deck must move with it.
