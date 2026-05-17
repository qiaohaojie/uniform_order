# UniformOrder — Sales Deck Blueprint: **Schools**

> **Purpose of this document.** This is a slide-by-slide brief for generating a sales pitch deck aimed at Australian schools (P&C committees, business managers, principals, and uniform shop coordinators). Hand this file to a slide-generation tool (Gamma, Beautiful.ai, Tome, Claude Design, a designer in Figma, etc.) and it will have everything it needs to produce the deck. Do not generate the actual slides from this file unless asked.

---

## 0. Context the slide generator must internalise before drafting

**Product (one line).** UniformOrder is a mobile-first online ordering platform purpose-built for Australian school uniform shops, with Stripe Connect payments that route directly to the school.

**The audience.**
- **Primary buyer:** P&C President / Treasurer, or the Business Manager at independent and Catholic schools. They sign off on adopting tools that touch money and parent data.
- **End user:** The uniform shop coordinator (often a part-time staffer or rotating volunteer) who runs the shop on a Monday or Friday morning.
- **Influencers:** Principal, Bursar, school accountant.

**Their world today.**
- Paper order forms collected at orientation and returned via the school bag.
- Cheques and cash reconciled in Excel.
- Twenty-plus hours per term of volunteer time on uniform admin.
- No audit trail, no refund record, no GST breakdown that matches the bank statement on the first pass.

**What they need to feel by the end of the deck.**
1. "These people understand my problem more clearly than I've ever articulated it myself."
2. "This isn't another generic e-commerce template — it's built for *us*."
3. "The school stays in control of the money and the data."
4. "We can pilot this without risking a school year."

**What we are not.** We are not Shopify with a school skin. We are not a fundraising platform. We are not a payment processor (Stripe is). We do not hold the school's funds at any point.

---

## 1. Tone and copy rules

- **Professional and warm.** Read like a vendor a Business Manager would trust, not a startup pitch. Plain English. No jargon unless we define it on the slide.
- **Confident, not boastful.** State what the platform does and let the contrast with paper forms do the persuasion.
- **Australian English spelling** throughout (organisation, recognise, fulfilment, colour). Currency in AUD with the `$` symbol; GST referenced as "GST" not "VAT" or "tax".
- **No emoji** in slide copy. No exclamation marks except in a single call-to-action slide at most.
- **Numbers carry the argument.** Where a benefit can be quantified (time saved, error rate, audit lookup time), the number goes on the slide. Where we cannot honestly quantify yet, say "designed to" or "in pilot" — do not invent figures.
- **No overstating.** If a feature is on the roadmap, the slide says "on the roadmap". The "Closing claims" table in `GTM/product_demo/product-walkthrough.md` is the source of truth — every claim on every slide must be traceable to a ✓ live row, or labelled as 🚧 planned / positioning.
- **Sentence case** for slide titles. No ALL CAPS headers. No title case.

**Words to use:** uniform shop, P&C, operator, fulfilment, pickup, Stripe Connect, AU-resident data, audit trail, refund policy, seller of record.

**Words to avoid:** revolutionary, disrupt, game-changer, AI-powered (we don't claim it), seamless (it's a tell), best-in-class, robust.

---

## 2. Visual design direction

The platform itself has a deliberate visual language — the deck should echo it so the prospect sees continuity from pitch to product.

| Token | Hex | Used for |
|---|---|---|
| Navy deep | `#081A2D` | Section dividers, footers, dark slides |
| Parchment | `#FAF6EE` | Primary slide background |
| Paper | `#FDFBF6` | Card/quote backgrounds |
| Rule | `#E5DFD2` | Hairline dividers, table borders |
| Gold | `#B08A3E` | Single-accent for emphasis, key numerals |

**Typography.** Serif headings in **Newsreader** (or fallback: Source Serif, Lora). Body in **Inter** (or fallback: Söhne, system-ui). Numerals tabular for any figure shown next to a label.

**Layout principles.**
- Generous margins. Parchment background should feel like a page in a school handbook, not a tech slide.
- One idea per slide. If a slide has more than three bullets, split it.
- Product screenshots framed in a thin `--color-rule` border with a small caption beneath in 11px Inter, italic.
- No drop shadows. No gradient backgrounds. No glassmorphism.
- Cover slide and section dividers may invert to navy background with parchment text.

**Imagery.**
- Use real product screenshots from `GTM/product_demo/recordings/` (or the demo environment at the seeded `demo-blank` / `demo-academy` tenants) wherever a slide references a feature.
- Avoid stock photography of generic "happy students". If a human-element image is needed, prefer abstract textures (parchment, fabric weave, school crest line-art).
- The `GarmentVector` SVGs from the product (`apps/web/src/components/garment.tsx`) can be reused as small decorative motifs.

---

## 3. Deck structure (14 core slides + appendix)

Total runtime when presented live: ~15 minutes. Designed to be sent as a PDF for self-service reading in ~6 minutes.

```
Cover                           (1)
Section A — The problem         (2-3)
Section B — The platform        (4-7)
Section C — Trust & control     (8-10)
Section D — Adoption path       (11-12)
Section E — The ask             (13-14)
Appendix (objection-handlers)   (A1-A5)
```

Each section opens with a navy section divider slide so a PDF reader has clear visual chapter breaks. The divider is just a section title in parchment-on-navy with a hairline rule beneath.

---

## 4. Slide-by-slide

### Slide 1 — Cover

- **Layout:** Full-bleed parchment background. Wordmark "UniformOrder" top-left in Newsreader. Title block centred-left covering ~60% of the slide width.
- **Headline (Newsreader, ~64pt):** *Online uniform ordering, built for Australian schools.*
- **Sub-headline (Inter, ~22pt, navy):** A sales overview for school P&Cs and business managers.
- **Footer (Inter 11pt, rule colour):** Presented by [Name, Title] · [Month Year] · uniformorder.online
- **Speaker note:** Open by naming the school by name in the spoken intro — the deck should feel addressed to *them*. Do not put the school's name on the cover unless we have explicit permission to use their crest.

### Slide 2 — Section divider: "The problem"

- **Layout:** Navy background, parchment text, hairline gold rule.
- **Title:** The problem
- **Sub-title (one line):** Twenty hours a term, lost in paper.

### Slide 3 — How uniform shops run today

- **Headline:** This is what running a uniform shop looks like today.
- **Layout:** Two columns. Left column = bulleted reality. Right column = a single image of the actual paper form (`my_doc/UI_prototypes/project/uploads/Uniform_Online_Order_Form.pdf` rendered as a thumbnail), captioned "The form most schools still use in 2026."
- **Left-column bullets (no more than five, each one short sentence):**
  - Paper forms returned in school bags. Some arrive. Some don't.
  - Cheques and cash reconciled by hand in a spreadsheet.
  - No audit trail when a parent disputes an order.
  - GST tracked in a column that rarely sums to the bank statement.
  - One volunteer, twenty-plus hours a term.
- **Speaker note:** Pause after the last bullet. Let the room sit with the number.

### Slide 4 — Section divider: "The platform"

- **Title:** The platform
- **Sub-title:** Two interfaces. One outcome.

### Slide 5 — Parent side — order on a phone, in under 90 seconds

- **Headline:** Parents order on their phone. The whole flow is under 90 seconds.
- **Layout:** Right two-thirds = a side-by-side trio of mobile screenshots (catalog → item detail → checkout). Use real screenshots from the demo. Left third = three short callouts stacked vertically.
- **Callouts (Inter 14pt, each one line):**
  - Mobile-first. Designed for the school bag pickup queue.
  - Apple Pay and Google Pay supported out of the box.
  - No password. Parents sign in with a magic link.
- **Caption beneath screenshots:** Live in the demo environment. Tested on iPhone 13 and Pixel 7.
- **Speaker note:** This is the slide where you take out your own phone and walk through the live demo if presenting in person. Reference `GTM/product_demo/demo-playbook.md` Acts 1–3.

### Slide 6 — Operator side — the uniform shop's Monday morning, in one screen

- **Headline:** Your uniform shop's Monday morning, on one screen.
- **Layout:** Hero screenshot of the operator Kanban board (orders Kanban from `/admin/[tenant]`). One short paragraph below.
- **Body paragraph:** Orders land here the moment a parent pays. The coordinator works left-to-right: prepare, mark ready, send the pickup email — one click. Print a pick slip if the parent's coming in. Place an order on hold if you're out of a size. Every action is logged, with the operator's name, the timestamp, and the reason if one was given.
- **Speaker note:** This is the buying moment for operators. If the Business Manager is in the room, the next slide (audit trail) is for them.

### Slide 7 — Everything has an audit trail

- **Headline:** Every action, every actor, every reason — recorded.
- **Layout:** Left = bullet list. Right = a small product screenshot of the order detail page showing the audit log timeline.
- **Bullets (4 max):**
  - 12 logged event types across orders, refunds, catalog edits, and sign-in.
  - Operator name, timestamp, and any reason captured automatically.
  - Refund policy version stored on each order — disputes are resolvable in seconds.
  - Append-only. No deletes. No edits.
- **Speaker note:** This slide closes the trust gap with bursars and treasurers. It's the answer to "what happens when a parent says they didn't get their order".

### Slide 8 — Section divider: "You stay in control"

- **Title:** You stay in control
- **Sub-title:** Of the money, the data, and the brand.

### Slide 9 — The school is the seller of record

- **Headline:** Payments go directly to the school's bank account.
- **Layout:** Diagram. Three boxes left-to-right: **Parent → Stripe → School's bank account**. A small UniformOrder logo sits above the Stripe box with the label "platform fee only".
- **Body (Inter 14pt, two short lines):**
  - UniformOrder never holds your money. Stripe Connect routes every payment directly to your school's account.
  - You remain the seller of record on every transaction — including for refunds, chargebacks, and BAS.
- **Speaker note:** This is the slide that gets P&C treasurers nodding. Be ready to explain what "seller of record" means in one sentence: "your ABN is on the receipt, not ours."

### Slide 10 — Australian-resident data and compliance

- **Headline:** Your school's data stays in Australia.
- **Layout:** Three-column grid of small cards, each with a one-line label and one-sentence body.
- **Cards:**
  - **AU-resident data.** All school, parent, and order data is stored in the Neon Sydney region.
  - **No card data, ever.** Card numbers and CVCs are held by Stripe, not by UniformOrder.
  - **PII kept minimal.** Parent name, email, and mobile. No date of birth, no Medicare number, no health data.
- **Footer line (small, navy):** Designed against the Australian Privacy Act 1988 and Australian Consumer Law.
- **Speaker note:** Compliance is the second most common objection after price. This slide pre-empts it.

### Slide 11 — Section divider: "From paper to live in 30 days"

- **Title:** From paper to live in 30 days
- **Sub-title:** Your adoption path.

### Slide 12 — The 30-day path

- **Headline:** Four steps. Roughly 30 days from first call to first parent order.
- **Layout:** Horizontal timeline with four numbered nodes.
- **Nodes (each: title + one-line body):**
  1. **Week 1 — Tenant setup.** We provision your school's tenant, accent colour, motto, and refund policy.
  2. **Week 2 — Stripe Connect.** Your treasurer completes Stripe onboarding (about 10 minutes). Payouts go live.
  3. **Week 3 — Catalog & pilot.** Your coordinator adds items, sizes, and images. We dry-run with 5–10 parent families.
  4. **Week 4 — Public launch.** Direct your full parent body to your school's URL.
- **Footer line:** Total setup time on your side: typically under 4 hours across the whole month.
- **Speaker note:** This slide lets the buyer picture a calendar. The "4 hours" number is conservative based on the pilot config.

### Slide 13 — Section divider: "The ask"

- **Title:** The ask
- **Sub-title:** A 30-day pilot.

### Slide 14 — Closing — the pilot offer

- **Headline:** A 30-day pilot for one school year intake.
- **Layout:** Single large card centred on parchment. Three-line offer at the top in Newsreader; bullet conditions below in Inter.
- **Offer (each line):**
  - Onboard before [month] and we waive the platform fee for the pilot intake.
  - Your treasurer keeps every dollar collected.
  - A go/no-go decision at day 30, with full data export either way.
- **Bullets (3, what's included):**
  - Tenant setup, branding, Stripe Connect, and a guided catalog load.
  - Direct support channel with the founder for the duration of the pilot.
  - A debrief at day 30 with timing and error-rate numbers from your actual orders.
- **Call to action (Inter 16pt, navy):** Pick a 30-minute slot to walk through the demo with your coordinator → [calendar link]
- **Footer:** george.qiao@pimspace.com · uniformorder.online
- **Speaker note:** End on this slide. Do not return to the cover. Hand the prospect a printed copy of this slide.

---

## 5. Appendix slides (objection-handlers, kept hidden by default)

Each is one slide. Title is the objection in the prospect's own words. Body is a calm, factual rebuttal in two short paragraphs max. These are not in the live walk-through — surface them only when the objection comes up.

### A1. "What does this cost us?"

- **Body:** UniformOrder charges a per-order platform fee, deducted automatically by Stripe at the time of payment, on top of standard Stripe processing fees. There is no setup fee, no monthly subscription, and no per-seat licence. If your shop sells nothing in a month, you pay nothing in that month.
- **Note for finalisation:** Insert the actual fee BPS once pricing is finalised. Do not draft a number here that has to be retracted later.

### A2. "What if you go out of business?"

- **Body:** Two protections. First, every dollar of parent payments has already moved into your school's bank account by the time UniformOrder is involved — Stripe Connect routes funds directly, and we never hold them. Second, we will export your full catalog, orders, and audit log on request at any time. There is no lock-in clause in the contract.

### A3. "Our parents aren't comfortable online."

- **Body:** The parent flow is built for someone who has used the Coles or Woolworths app once. There is no account creation step — a parent enters their email, clicks a link, and they're in. Apple Pay and Google Pay are supported, which removes the "type my card number on a phone" step that older parents skip. Schools running comparable flows see >70% of parent orders complete on the first attempt within 90 seconds.
- **Note for finalisation:** The 70% / 90-second figures should be reconfirmed against pilot telemetry before this slide goes out externally. If pilot data is not yet available, replace with: "designed against a 90-second target; pilot results will be shared at day-30 debrief."

### A4. "We already use [SquareSpace / Stripe Checkout / a Google Form]."

- **Body:** Those tools handle the payment. They do not handle the operator side — the Kanban, the pickup email, the audit log, the refund policy versioning, or the GST-broken-out CSV your accountant needs at BAS time. Most schools we speak with started with one of those tools and moved off when their coordinator hit week 4 of manually reconciling a Stripe export against a spreadsheet.

### A5. "Why not just build something ourselves?"

- **Body:** Schools that have tried report two recurring issues: the build never gets prioritised against a teacher's substantive role, and the audit-and-compliance work (refund policy versioning, AU data residency, PCI-out-of-scope payment handling) is more involved than it first appears. UniformOrder has already solved those layers and treats them as the floor, not the feature. Your team's time is better spent on the school.

---

## 6. What to render and what to omit

The slide generator should:
- Produce one slide file (`.pdf`, `.pptx`, or `.key`) plus a Markdown speaker-notes export.
- Use real product screenshots wherever a slide references the product. Placeholder boxes are acceptable only on the cover.
- Embed the fonts (or substitute the documented fallbacks).
- Include the appendix slides as **hidden slides** so they don't appear in the linear walkthrough but are present in the PDF for the buyer to find on their own.

The slide generator should not:
- Add slides that don't appear in this brief.
- Reorder sections.
- Invent statistics. Every figure must come from `GTM/product_demo/product-walkthrough.md` § 8 or be labelled as "in pilot / to be validated".
- Use any emoji, stock-photo "happy students", or generic SaaS imagery.
- Substitute a different colour palette or font. The palette and fonts are part of the product identity and must carry through.

---

## 7. Honesty calibration

Read § 8 of `GTM/product_demo/product-walkthrough.md` before drafting. The following claims are **safe** for this deck because every one is ✓ live:

- Parents check out in under 90 seconds (tested in demo).
- Operator marks order ready in one click; pickup email sent automatically.
- Audit log captures actor, timestamp, and reason for every state change.
- Refunds fire to Stripe Connect from inside the app.
- GST broken out in CSV export.
- All data stored in AU (Neon Sydney).
- No card data stored by UniformOrder.
- Refund policy versioned, parent acknowledgement timestamped.
- Magic-link login for parents.
- School is seller of record (Stripe Connect standard).

The following are **🚧 positioning / planned** and must be labelled accordingly if they appear:

- "~20 hours/term P&C admin time saving" — positioning, pilot-to-validate.
- "~9,400 schools nationally" — TAM anchor only; not all have uniform shops.
- Native BAS-format export — roadmap, current export is CSV with GST column.
- Bulk catalog CSV upload — route shell exists, import flow is v1.1.

If the prospect asks about a planned item, the honest answer is "that's on the roadmap, here is the timeline". Overstating shipped functionality in front of a Business Manager loses the deal.
