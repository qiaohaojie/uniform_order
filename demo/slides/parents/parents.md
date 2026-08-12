# UniformOrder — Sales Deck Blueprint: **Parents**

> **Purpose of this document.** This is a slide-by-slide brief for generating a short, conversion-focused deck aimed at parents at a school that has just adopted UniformOrder. It is typically:
> - Embedded in the school's launch newsletter, or
> - Shown by the P&C at an orientation evening, or
> - Linked from the school's "Uniform Shop" page on the school website.
>
> Hand this file to a slide-generation tool and it will have everything it needs. Do not generate the actual slides from this file unless asked.

---

## 0. Context the slide generator must internalise

**The audience.** Parents and carers at an Australian primary or high school. Demographics are wider than typical SaaS audiences — assume a reader between 28 and 65, with mixed comfort levels using a phone for payments. Some are first-time school parents (kindy / Year 7) and have never bought a uniform before; others have done it eight times and are tired of the paper form.

**Their unsaid concerns.**
- "Is this legitimate? Did the school actually ask me to do this, or is this a scam?"
- "Will my card details be safe?"
- "What happens if my child grows out of the size before they wear it?"
- "What if my kid loses the receipt — can I find proof of what I ordered?"
- "How long will this take? I have three more emails to deal with."

**The goal of the deck.** Move the parent from email-inbox-skim to "open the link, place the order, done". The deck is not a feature pitch. It's a confidence and convenience pitch.

**What we are not asking parents to do.** Sign up, register, create a password, or download an app. They tap the school's link, enter their email, get a magic-link, and order.

---

## 1. Tone and copy rules

- **Warm and human.** Read like a note from the school P&C, not from a software company. If a sentence feels like marketing, rewrite it.
- **Short sentences.** Average 12 words. No sentence longer than 22.
- **Address the parent directly** with "you" and "your child" — never "users" or "customers".
- **Australian English.** "Mum" and "dad" not "mom" and "dad". "Uniform shop" not "uniform store". "Mobile" not "cell".
- **No marketing words.** Avoid: simple, seamless, easy, effortless, magic, hassle-free, in just a few clicks. If something is genuinely simple, the slide demonstrates it visually rather than asserting it in copy.
- **No exclamation marks.** Anywhere. The deck should feel calm, not enthusiastic.
- **Currency:** AUD with `$` symbol. Round prices to the dollar when shown as examples.
- **Numbers:** Spell out one through nine in body copy; use digits for 10+.

**Words to use:** order, uniform shop, your child, year level, pickup, refund policy, your school's bank account, magic link.

**Words to avoid:** seamless, hassle-free, just, simply, revolutionise, transform, modern, cutting-edge, AI, cloud.

---

## 2. Visual design direction

The deck should match the school's parent-shop branding so a parent who clicks through doesn't experience a visual handoff.

| Token | Hex | Used for |
|---|---|---|
| Parchment | `#FAF6EE` | Slide backgrounds — primary |
| Paper | `#FDFBF6` | Card backgrounds for any callout |
| Navy deep | `#081A2D` | Headings, footer band |
| Gold | `#B08A3E` | One accent per slide max — usually a check mark or a number |
| Rule | `#E5DFD2` | Hairline dividers |

**The accent colour should switch per school deployment.** When the deck is generated for a specific school, the gold accent above can be replaced with the school's `accent_colour` token (e.g. IMHS navy, RGSH crimson) read from the tenant settings. If no school is specified, default to gold.

**Typography.** Newsreader for slide headlines (24–48pt). Inter for body (14–18pt). No mixed-weight headlines; pick one weight per slide.

**Layout principles.**
- One screenshot per slide max. Parents look at the screenshot, then the headline.
- White space generous. The parchment background must not be crowded.
- Phones shown in a thin charcoal frame (not a glossy mockup with reflections). Imagine a screenshot pasted on a noticeboard, not a tech-startup hero shot.
- No "before / after" comparisons against the paper form. The audience is the parent, and many of them filled in those forms cheerfully for years. Don't make them feel silly for it.

**Imagery.**
- Real parent-side screenshots from the demo environment. The `MobileShell` (430px constraint) is the canonical frame.
- A single optional photograph is acceptable on the cover slide: a school crest or a folded uniform stack. No stock smiling families.

---

## 3. Deck structure (8 slides, fits on one PDF page if printed)

```
Cover                      (1)
What changed               (2)
What you'll do             (3)
On the phone               (4)
At checkout                (5)
After you order            (6)
If something goes wrong    (7)
Start                      (8)
```

Total reading time: under 90 seconds. Total speaking time at orientation: 4 minutes.

---

## 4. Slide-by-slide

### Slide 1 — Cover

- **Headline (Newsreader, ~52pt):** *Ordering uniforms is moving online.*
- **Sub-headline (Inter, ~20pt, navy):** A short walkthrough from [School Name]'s P&C.
- **Layout:** Parchment background. Headline left-aligned, occupying the top-left quadrant. School crest (if available) bottom-right at small scale. Optional thin gold rule under the headline.
- **Footer:** [School Name] uniform shop · [Month Year]
- **Speaker note:** When this deck is generated for a specific school, replace `[School Name]` with the tenant's `display_name` and use the tenant accent colour for the rule under the headline.

### Slide 2 — What changed

- **Headline:** Same uniform shop. New way to order.
- **Body (two short paragraphs):**
  - Starting [Month], you can order your child's uniform from the school shop on your phone. The shop is still run by the same team. The uniforms are the same. The prices are the same.
  - The paper form is no longer needed. If your family prefers the paper form, it remains available at the school office.
- **Layout:** Headline at top, body in a single column centred. No imagery on this slide — it is intentionally calm.
- **Speaker note:** The "paper form is still available" line matters. Some families will need it. Don't pull it on the launch slide; you lose trust.

### Slide 3 — What you'll do, in one screen

- **Headline:** Four steps. Under two minutes.
- **Layout:** Vertical numbered list, generous spacing.
- **Steps:**
  1. Go to **[your school's URL]** on your phone.
  2. Pick the items and sizes your child needs.
  3. Enter your child's name, year level, and roll class.
  4. Pay with your card, Apple Pay, or Google Pay.
- **Footer line:** You can do this any time. The shop is open 24 hours.
- **Speaker note:** The "Apple Pay or Google Pay" line is the trust shortcut for older parents who don't want to type a card number on a phone.

### Slide 4 — On the phone

- **Headline:** Browse like any other shop on your phone.
- **Layout:** Single mobile screenshot, centred, framed in a thin charcoal device frame. Caption beneath in 11pt italic.
- **Caption:** The parent shop on an iPhone 13. Designed for the queue at school pickup.
- **Body (one line, beneath the caption):** Tap an item to see sizes and the school's size guide. Add it to your cart.
- **Speaker note:** This slide carries no claim. It just shows the shop. Pause two seconds when speaking.

### Slide 5 — At checkout

- **Headline:** Your payment goes straight to the school.
- **Layout:** Two-column. Left = a small Stripe-branded mobile checkout screenshot (Payment Element with Apple Pay button visible). Right = three bullets.
- **Bullets:**
  - The school's bank account receives the payment, not a middleman.
  - Card details are handled by Stripe — used by the major Australian retailers you already shop with.
  - You confirm the school's refund and exchange policy before you pay. We'll show you what it says.
- **Speaker note:** This is the trust slide. Don't add a fourth bullet. The point is calm reassurance.

### Slide 6 — After you order

- **Headline:** You'll get an email straight away. Another when it's ready to collect.
- **Layout:** Two-column. Left = thumbnail of the order confirmation email. Right = thumbnail of the "ready for collection" email. Captions beneath each.
- **Captions:**
  - Order confirmation — sent immediately.
  - Ready for pickup — sent when the uniform shop has your order set aside.
- **Body (one line beneath the images):** Your full order history is always visible at the same URL. You don't need to keep the receipt.
- **Speaker note:** Parents lose receipts. Telling them they don't need to keep one is a small relief that lands.

### Slide 7 — If something goes wrong

- **Headline:** A real person at your school's uniform shop, not a chatbot.
- **Body (two short paragraphs):**
  - The same uniform shop coordinator handles questions about your order. Their contact details are on the order confirmation email and on every page of the shop.
  - Refunds and exchanges follow your school's published refund policy. You can view that policy any time from the shop's footer.
- **Layout:** Centred single column. Optional small icon (a hand with a tag, or a school bell) above the headline in gold or the school accent colour.
- **Speaker note:** This slide is the answer to the parent's biggest fear: "I'll buy something online and not be able to fix it if it's wrong." Don't undersell the human-on-the-other-end.

### Slide 8 — Start

- **Headline:** Your school's uniform shop is here.
- **Sub-headline (Inter 22pt, navy):** [your school's URL]
- **Layout:** Parchment background. URL displayed prominently in Newsreader, ~44pt. A small QR code beneath the URL pointing to the same address. A single accent-coloured rule above the URL.
- **Footer (small):** Run by the [School Name] P&C. Contact the uniform shop at [shop email].
- **Speaker note:** This is the slide that goes on the noticeboard, in the newsletter, and as the LinkedIn image. Generate the QR at PDF export time so it points to the live tenant URL.

---

## 5. What to render and what to omit

The slide generator should:
- Render a print-friendly PDF (A4 portrait works if the deck is going into a school newsletter) **in addition to** a 16:9 presentation file.
- Replace `[School Name]` and `[your school's URL]` placeholders with real values when a specific tenant is named. If the deck is generic, leave the placeholders visible and provide a Find-and-Replace note on the cover.
- Use the tenant's accent colour (from `tenant_settings.accent_colour`) wherever the brief says "gold or school accent".
- Generate a QR code for Slide 8 that resolves to `https://uniformorder.online/[tenant]`.

The slide generator should not:
- Add a feature comparison slide. This is not a competitive deck.
- Add a privacy / data-handling deep-dive. Parents who want that detail will read the linked Privacy page; surfacing the technical wording here is anxiety-inducing.
- Add screenshots of the operator side. Parents do not need to see the operator's tools.
- Add testimonials unless they are real and attributed with the parent's permission.

---

## 6. Honesty calibration

Every feature claimed in this deck is ✓ live (see `demo/product_demo/product-walkthrough.md` § 8): magic-link sign-in, Apple Pay / Google Pay at checkout, order confirmation and ready-for-pickup emails, refund policy versioning with parent acknowledgement, school as seller of record. Nothing in this deck describes a planned or in-design feature.

If the school's P&C asks you to add a feature that is on the roadmap (e.g. "show parents the bulk catalog upload"), decline. Surface only what works today. Parents who experience a missing feature on day one lose trust faster than any sales claim can rebuild it.

---

## 7. Variants to generate

When this blueprint is processed, produce three deliverables in parallel:

1. **`parents-deck.pdf`** — the 8-slide presentation in 16:9.
2. **`parents-newsletter.pdf`** — slides 1, 3, 5, 6, 8 as a single-page A4 newsletter insert.
3. **`parents-poster.pdf`** — Slide 8 only, blown up to A3 portrait, suitable for the school office noticeboard.

All three share the same source content and visual identity. Generating all three at once keeps the school's launch communications coherent.
