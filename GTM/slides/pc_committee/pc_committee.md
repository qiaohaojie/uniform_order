# UniformOrder — Sales Deck Blueprint: **P&C Committee**

> **Purpose of this document.** This is a slide-by-slide brief for generating a pitch deck aimed at a school's Parents & Citizens (or Parents & Friends) committee — the volunteer body that runs the uniform shop in most Australian schools. The deck is intended to be presented at a monthly P&C meeting, with copies circulated to absent members afterwards. Hand this file to a slide-generation tool and it will have everything it needs. Do not generate the actual slides from this file unless asked.

---

## 0. Why this deck is different from the "Schools" deck

The schools deck (`../schools/BLUEPRINT.md`) is pitched at the **institution** — the Business Manager, the Principal, the Bursar. Decision criteria are institutional: compliance, control, brand.

This deck is pitched at the **committee**. The audience is volunteers, mostly parents, who already have full-time jobs and run the uniform shop on top of them. Their decision criteria are personal and operational:

- "How much of my Saturday does this save me?"
- "What happens when I hand over to next year's treasurer?"
- "If a parent accuses us of pocketing money, how do we prove what happened?"
- "Will this annoy our volunteer roster?"
- "Does this give us more time and money to put into the things the P&C actually exists for — fundraising, reading support, canteen?"

The deck must respect that the audience is doing this for free, after hours, because they care about the school. That respect threads through every slide.

---

## 1. Context the slide generator must internalise

**The audience.** A P&C committee, typically 6–12 elected volunteers. Roles include President, Vice President, Secretary, Treasurer, and committee members. The Treasurer is the most important reader — they sign cheques, reconcile to the school's bank statement, and front up to AGM with the year's figures.

**Their world today.**
- They inherited the uniform shop from last year's committee, possibly with a folder of paper forms and a spreadsheet of uncertain provenance.
- The uniform shop is one of three or four things they run (canteen, second-hand uniforms, sausage sizzles, book club).
- They meet once a month for two hours in a school library or staff room.
- The Treasurer spends ~5 hours a month on reconciliation. The shop coordinator spends another 15 hours a term.
- At the end of the year, they hand the entire operation to a new committee, with whatever documentation they happened to keep.

**What they need to feel by the end of the deck.**
1. "These people understand what it's like to volunteer for this."
2. "The audit trail protects *us* — not just the school."
3. "Next year's committee will inherit a working system, not a folder."
4. "This makes the P&C look more professional to the parent body, not less hands-on."
5. "We can pilot this without putting our remaining cash at risk."

**What we are not.** We are not asking the P&C to take on a new vendor obligation that outlives their term. We are not asking them to learn complex software. We are not asking them to vouch for technology they don't understand — Stripe and the school's bank account are the trust anchors, not us.

---

## 2. Tone and copy rules

- **Peer-to-peer, not vendor-to-customer.** Write as if the founder is sitting in the P&C meeting at the back of the room. No "we are excited to introduce". No "as the leading platform".
- **Acknowledge the volunteer reality.** The deck should reference Saturday mornings, handover meetings, AGM reports, and the uniform shop on Monday — the actual rhythm of a P&C year.
- **Plain English.** Average sentence length 14 words. No "leverage", "enable", "facilitate". Use the verbs people use in a P&C meeting: "run", "save", "track", "show", "pay", "fix".
- **Australian English** throughout. References to fundraising, BAS, GST, ABN, P&C, Treasurer's report, AGM.
- **Numbers are conservative.** Where we quote a time saving, the slide must say "in our pilot, X hours saved" or "designed to save approximately X hours" — never just a number. The audience has personally experienced the workload and will smell exaggeration.
- **No marketing words.** Same exclusion list as the other decks: revolutionise, seamless, transform, magic, just, simply, cutting-edge. Add: "empower", "unlock", "supercharge".
- **No exclamation marks.** No emoji. Use a Newsreader-style "✓" glyph for checkmarks.

**Words to use:** P&C, committee, Treasurer, AGM, handover, fundraising, surplus, school community, parent body, uniform shop, coordinator, roster, audit trail, school's bank account.

**Words to avoid:** revolutionise, transform, seamless, empower, supercharge, unlock, modernise, digital transformation, solution provider.

---

## 3. Visual design direction

Same visual language as the schools / parents decks — but slightly warmer and less corporate, because this audience reads as a committee, not as buyers.

| Token | Hex | Used for |
|---|---|---|
| Parchment | `#FAF6EE` | Primary slide background |
| Paper | `#FDFBF6` | Card / quote backgrounds |
| Navy deep | `#081A2D` | Section dividers, headings |
| Gold | `#B08A3E` | One accent per slide — usually a checkmark or numeral |
| Rule | `#E5DFD2` | Hairlines and table borders |

**Typography.** Newsreader for headlines (~44pt). Inter for body (14–18pt). Avoid the largest display sizes — this is a discussion deck, not a keynote.

**Layout principles.**
- More body text per slide than the schools or parents decks is acceptable here. P&C members read carefully and ask questions. Each slide can sustain two short paragraphs.
- A "Treasurer's view" callout appears on three slides — render as a paper-coloured inset card with a hairline rule, labelled "For the Treasurer:" in Newsreader italic at 12pt. This is the device that signals "this slide also speaks to you specifically".
- Tables for figures should look like a P&C meeting handout: thin rules, tabular numerals, no zebra stripes, no shading.
- Product screenshots framed in a thin rule with a one-line caption in italic.

**Imagery.**
- Real product screenshots from the demo environment.
- A single optional image on the cover slide: a folded uniform stack, a parchment-and-pen still life, or the school's crest line-art. No stock photography of meetings, families, or "diverse committees".

---

## 4. Deck structure (12 slides + 3 appendix)

```
Cover                                (1)
Section A — What you already know   (2-3)
Section B — What changes for you    (4-7)
Section C — What changes at handover (8-9)
Section D — The pilot proposal      (10-12)
Appendix                            (A1-A3)
```

Total runtime when presented at a P&C meeting: ~15 minutes including questions. Designed to fit the typical "guest presentation" slot in a monthly committee meeting.

---

## 5. Slide-by-slide

### Slide 1 — Cover

- **Headline (Newsreader 52pt):** *Running the uniform shop, without the weekend.*
- **Sub-headline (Inter 20pt, navy):** A proposal for the [School Name] P&C.
- **Layout:** Parchment background. Headline top-left occupying the top half. Sub-headline directly below with a thin gold rule between. Small footer in 11pt: "Presented at the [Month Year] P&C meeting · support@pimspace.com".
- **Speaker note:** Open by thanking the committee for the time slot. Acknowledge by name — Treasurer, President, and the current uniform shop coordinator if present — that this proposal is built around their workload.

### Slide 2 — Section divider: "What you already know"

- **Title:** What you already know
- **Sub-title:** A quick check that we're picturing the same shop.

### Slide 3 — The volunteer load, as it stands

- **Headline:** A snapshot of the year, from a P&C calendar.
- **Layout:** Single column, three short paragraphs.
  - **Para 1 — The intake spike.** Late January and the start of Term 3 (Year 7 intake at high schools) account for roughly 60% of the year's order volume. The shop coordinator and the Treasurer absorb it together, on top of their regular work.
  - **Para 2 — The reconciliation tail.** Every month, the Treasurer matches order forms, cheque deposits, and cash counts to the school's bank statement. The mismatch is rarely zero on the first pass.
  - **Para 3 — The handover gap.** At AGM, the operation moves to a new committee. What's handed over is a folder, a spreadsheet, and whatever institutional knowledge the outgoing Treasurer remembers to mention.
- **Footer:** These figures match the workflow described in `GTM/product_demo/product-walkthrough.md` §1; pilot data will refine them per school.

### Slide 4 — Section divider: "What changes for you"

- **Title:** What changes for you
- **Sub-title:** Three changes. Each one you'll feel in the first month.

### Slide 5 — Change 1 — the orders arrive sorted

- **Headline:** Orders arrive pre-sorted, pre-paid, and pre-reconciled.
- **Layout:** Two-column. Left = three bullets. Right = a screenshot of the operator Kanban.
- **Bullets:**
  - Every order is paid in full before it appears in your list. No cheques to chase.
  - Each order shows the student name, year level, and roll class. No transcription.
  - The shop coordinator marks an order ready with one tap. The parent gets the pickup email automatically.
- **Caption beneath screenshot (italic, 11pt):** The orders board, from the demo environment.
- **Treasurer's view card (inset):** Every paid order writes to the bank statement the same day. The line item is labelled with the order number, so reconciliation is a copy-paste, not a hunt.

### Slide 6 — Change 2 — the money goes straight to the school

- **Headline:** Payments land in the school's bank account, not ours.
- **Layout:** Diagram — three boxes left to right: **Parent → Stripe → School's bank account**. UniformOrder logo sits above Stripe with a small label "platform fee only — collected by Stripe at the moment of payment".
- **Body (Inter 14pt, two short paragraphs):**
  - You stay the seller of record on every transaction. Your ABN is on the receipt. Refunds come out of the school's account, not a third-party balance we hold.
  - UniformOrder is paid a small fee per order, taken automatically by Stripe at the point of sale. If no orders are placed in a month, no fees are charged. There is no monthly subscription and no setup fee.
- **Treasurer's view card (inset):** The Stripe export is a single CSV per month. Each row carries the order number, GST-inclusive total, and refund flag. It is designed to be pasted directly into the Treasurer's reconciliation sheet.
- **Speaker note:** Pause on the diagram. Let the Treasurer ask their question about who holds the money — answer: nobody but Stripe and the school.

### Slide 7 — Change 3 — the audit trail protects the committee

- **Headline:** Every action recorded. With your name on it, and the reason you gave.
- **Layout:** Two-column. Left = bullet list. Right = a small screenshot of an order detail page showing the audit timeline.
- **Bullets:**
  - Every refund records who processed it, when, and why.
  - Every catalog change (price update, size addition, item removed) records who edited it.
  - The audit log is append-only. Nothing can be quietly edited or deleted.
  - The school's refund policy is versioned. Every order is permanently linked to the policy text the parent accepted.
- **Treasurer's view card (inset):** If a parent complains six months later that they were charged twice or refunded the wrong amount, the answer is in the log. Two clicks. You do not have to find the volunteer who handled it.
- **Speaker note:** This is the trust slide. P&C committees are accused of mishandling money occasionally — sometimes fairly, usually not. The audit trail is the defence.

### Slide 8 — Section divider: "What changes at handover"

- **Title:** What changes at handover
- **Sub-title:** The next committee inherits a working system, not a folder.

### Slide 9 — Handover, on the day after AGM

- **Headline:** What the next Treasurer sees when they log in for the first time.
- **Layout:** Single column, narrative.
- **Body (three short paragraphs):**
  - **Para 1 — Continuity of access.** Outgoing roles are deactivated; incoming roles are invited by email. The new Treasurer signs in with their own credentials. No shared password is handed across — and nothing is lost when one is forgotten.
  - **Para 2 — Continuity of history.** Every order, every refund, every catalog item the previous committee approved is visible from the day the new Treasurer signs in. The full year's audit log is one search away.
  - **Para 3 — Continuity of policy.** The refund policy the previous committee approved remains in force until the new committee chooses to update it. When they do, the change creates a new version, and old orders remain linked to the old policy.
- **Footer line (italic, 11pt):** Handover at AGM stops being the riskiest meeting of the year.
- **Speaker note:** Many committees have a story about a handover that went badly. Acknowledge it without naming it. Let the Treasurer respond.

### Slide 10 — Section divider: "The pilot proposal"

- **Title:** The pilot proposal
- **Sub-title:** A single term. Fee-waived. Your committee decides at day 30.

### Slide 11 — What we are proposing

- **Headline:** A one-term pilot. No commitment beyond it.
- **Layout:** Single card on parchment, large enough to dominate the slide.
- **Top of card (Newsreader 24pt):** A 30-day pilot, fee waived for the pilot intake.
- **Bullets beneath (Inter 14pt):**
  - We provision your school's tenant, branding, and refund policy text from your existing P&C wording.
  - Your Treasurer completes Stripe Connect — about 10 minutes, on their own laptop.
  - Your coordinator loads the catalog with our help on a single call, around 90 minutes total.
  - Your full parent body gets the link in the next newsletter. Orders start arriving the same day.
- **Bottom of card:** A go/no-go vote at the next P&C meeting after day 30, with a full data export either way.
- **Speaker note:** The "data export either way" is the lock-in answer before someone asks. The committee can leave with their data at any point — there is no contract that ties next year's committee to a decision this year's committee made.

### Slide 12 — Closing — what we'd like from this meeting

- **Headline:** What we're asking the committee to decide tonight.
- **Layout:** Single column, three numbered lines, generous spacing.
- **Lines:**
  1. A motion to authorise the President and Treasurer to enter into a 30-day pilot.
  2. A nominated coordinator for the catalog load — typically the current uniform shop volunteer.
  3. A standing 10-minute slot on the next P&C agenda for a pilot debrief.
- **Footer (small):** Contact: support@pimspace.com · uniformorder.online
- **Speaker note:** Hand the President a one-page printed version of this slide to attach to the minutes. Do not return to the cover slide. Take questions.

---

## 6. Appendix slides (kept hidden by default)

### A1. "Where does the platform fee come from?"

- **Headline:** What the fee covers, and what it doesn't.
- **Body (two short paragraphs):**
  - The fee is a small percentage of each order, taken at the point of sale by Stripe and routed to UniformOrder automatically. It covers the platform's hosting, software development, support, and compliance work. There is no monthly subscription, no per-user licence, and no setup fee.
  - It does not cover Stripe's standard processing fee, which Stripe deducts separately. The CSV export shows both lines so the Treasurer can reconcile each independently.
- **Footer note:** The actual fee percentage is finalised in the pilot agreement. Do not draft a number on this slide that has to be retracted later.

### A2. "What if the P&C wants out?"

- **Headline:** Exit is a single export, and it's yours to keep.
- **Body (two short paragraphs):**
  - At any time during or after the pilot, the committee may request a full export of the school's catalog, orders, refunds, and audit log. The export is a set of CSV files plus a copy of the refund policy version history. There is no charge for the export.
  - The school's Stripe Connect account belongs to the school regardless of whether UniformOrder is in the loop. Disconnecting the platform stops new orders from being placed; it does not affect past records or money that has already moved.

### A3. "What does the fundraising side look like?"

- **Headline:** The uniform shop, run cleanly, frees up the P&C for the rest of its year.
- **Body (single paragraph):**
  - The platform exists for the uniform shop specifically. The same multi-tenant architecture can later be extended to support sports carnival merchandise, formal event tickets, second-hand uniform sales, and other school-managed transactions. None of that is built yet, but the committee that pilots the uniform shop is well-placed to influence what gets built next.
- **Footer note:** This slide is positioning, not a roadmap commitment. Use it only if the conversation explicitly turns to fundraising adjacencies.

---

## 7. What to render and what to omit

The slide generator should:
- Produce a 16:9 PDF for the projector in the school library, **and** an A4 portrait one-page handout that summarises Slides 5, 7, 9, and 11. The handout is what the absent committee members receive in the meeting minutes.
- Use real product screenshots from the demo environment. The Kanban screenshot (Slide 5) and the audit-log screenshot (Slide 7) are the most important — both should be from a tenant whose branding looks plausible (use `demo-academy` rather than `demo-blank` for these).
- Render the appendix slides as hidden by default so they don't appear in the linear walkthrough.
- Replace `[School Name]` and `[Month Year]` placeholders before any send.

The slide generator should not:
- Add a competitive slide (this audience does not benefit from comparison-to-Shopify framing).
- Add a "team" slide unless the founder is unknown to the committee — for a warm meeting, the founder introduces themselves verbally and the deck stays focused on the proposal.
- Add testimonials unless they come from a real P&C, attributed by school name and committee role with permission.
- Use stock photography of committees, smiling volunteers, or "diverse parents at a meeting".

---

## 8. Honesty calibration

Read § 8 of `GTM/product_demo/product-walkthrough.md` before drafting.

**Safe to state as fact (every claim below is ✓ live):**
- Orders are paid in full before they appear on the operator board.
- The school's bank account receives every payment via Stripe Connect.
- The school remains the seller of record.
- Every operator action is logged with actor, timestamp, and reason.
- The audit log is append-only.
- The refund policy is versioned per tenant.
- The CSV export breaks out GST per line.
- The school's data is stored in AU (Neon Sydney).

**Must be labelled as positioning or pilot-to-validate:**
- "5 hours a month for the Treasurer" / "15 hours a term for the coordinator" — workflow estimates from the paper-form analysis, not measured pilot outcomes. The slide should say "in a typical paper-form workflow" rather than asserting a saved-hours figure.
- Pilot fee structure — defer to the pilot agreement; do not name a fee on the slide.
- Fundraising adjacency (Appendix A3) — positioning only, not a roadmap commitment.

A P&C committee will smell exaggeration faster than any other audience in the GTM corpus. They have personally done the work. Understatement reads as competence; overstatement reads as a sales pitch.

---

## 9. Tactical notes for the presenter

(These are notes for whoever delivers this deck — not for the slide generator.)

- **Bring a printed copy of the handout for every seat.** P&C members take notes on paper. Digital decks circulate after the meeting; the printed handout is what gets discussed in the meeting itself.
- **Address the Treasurer's questions first if they speak.** The Treasurer's vote determines this; the President's vote will follow it nine times out of ten.
- **Do not interrupt the discussion that follows Slide 11.** The committee will turn to each other and negotiate. The pitch is over by that point — your job is to answer specific questions, not to keep selling.
- **Leave the appendix unprinted unless asked.** If the conversation turns to fees, exit terms, or fundraising adjacency, you can hand out the relevant appendix slide on its own page.
