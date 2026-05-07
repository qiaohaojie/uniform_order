# Parent ↔ School Linking — How Parents Onboard to a Tenant

**Date:** 2026-05-07
**Context:** Brainstorming `docs/remaining_work.md §3.3` ("Add another child" flow on the school picker) raised the deeper question: *how does a parent become "linked" to a school on the platform?* Do we need an invitation token, an enrolment check, a per-parent code, a school-staff approval step? This doc records the answer and the reasoning, so future onboarding work and per-tenant policy questions can refer back to it.
**Decision (v1):** No "linking" workflow exists. The school's URL slug *is* the invitation. Anyone with the URL can shop. No token, no enrolment verification, no staff approval. Schools are listed publicly on the picker only when they opt in via a tenant flag.

**Decision (v1, parent identity):** Parents have a real account on the platform, with **magic-link email auth** and a DB-backed list of saved children scoped to their account. Storing children's profiles server-side is lawful under the APPs with minimisation + collection notice + access/delete UI + a retention rule — this is standard SaaS privacy hygiene, not a heavy compliance stack. See "Storing children server-side: what the law actually requires" below.

---

## The entity model

| Role | What they actually are | Relationship to the platform |
|---|---|---|
| **School (tenant)** | Seller of record. Holds the Stripe Connect account; receives funds; owns the refund policy; ultimately responsible for fitness-for-purpose under ACL. | First-class entity on `tenants` row. |
| **Parent / purchaser** | The credit-card holder. Often a parent, sometimes grandparent / aunt / step-parent / school welfare officer / neighbour helping out. | **Not a member.** Transactional customer identified by email at checkout. No auth, no account, no log-in. |
| **Child** | Subject of the transaction — uniform recipient. Recorded on order line items (name, year, roll class) so the school can bag and label. | **No platform presence** outside order line items. We do not maintain a roster, do not verify enrolment, do not issue IDs. |

The platform is **a shopfront-as-a-service for the school**, not a parent CRM, not an enrolment system, not a child-data registry. The school's SIS is the source of truth for "who is enrolled here"; we never touch it.

---

## Common practice in the Australian uniform-shop market

The major Australian online uniform shops all operate the same way:

| Platform | Linking model |
|---|---|
| **Lowes Schoolwear** (`lowes.com.au/schools/<slug>`) | Public school list; pick any school; no auth, no verification. Anyone can buy. |
| **Midford Uniforms** | School-specific subdomain or page; public; no auth. |
| **Noone Imagewear** | School-specific page; public; some have a static "access code" printed in the enrolment pack — not a per-parent identity. |
| **Alinta Apparel** | Public school pages; no auth. |
| **Bocini / Nellgray / regional shops** | Often even simpler: single public catalog with school selector at checkout. |

**No major Australian uniform-shop platform requires schools to issue per-parent invitation links or verify enrolment.** When schools do gate access, it's a static low-friction code (sometimes literally on the enrolment letter), not an identity flow.

This isn't an oversight — it's deliberate, and matches the offline model.

---

## Why schools are comfortable with public access

This was the question that surprised us. The reasons schools accept public access — and reject verification — are consistent across the market:

1. **Physical uniform shops have always been walk-in.** A parent can walk into the NSBH uniform shop on a Monday morning, hand over cash, walk out with a blazer, no questions asked. The online shop is just a different till. There's no policy reason it should be stricter than the physical one.

2. **The "fraud" gating would defend against barely exists.** The realistic non-parent buyers are all legitimate: grandparents, separated parents (often the non-custodial parent helping with back-to-school), neighbours helping out, second-hand buyers (school-encouraged in many cases), costume hire, alumni nostalgia. The single hypothetical bad actor — a school impersonator — is extraordinarily rare and not a uniform-shop problem.

3. **Branded items are the exception, and it's a per-item question.** Prefect ties, leadership badges, house captain blazers — schools sometimes restrict these, but they handle it at *fulfilment* (staff signs off at collection), not at *purchase*. Same model works online: a per-item `requires_staff_approval` flag, not a per-parent gate.

4. **The school sees every paid order on their dashboard.** If something looks off, they refund and don't fulfil. They have full control at the point that actually matters: dispatch.

The reason a school *feels* like they should want gating is brand instinct ("our uniform should be for our families"), but when actual edge cases are walked through with a uniform-shop coordinator, the gating cost always exceeds the benefit.

---

## Legal lens (Australia, the platform)

### Children's data — what the law actually requires

Earlier drafts of this doc treated server-side storage of children's profiles as something close to a legal wall. **That was overcautious and is corrected here.** Storing children's name + year + parent email under a parent account is lawful under Australian privacy law, provided we apply standard SaaS privacy hygiene. The lift is modest, not heavy.

The Australian Privacy Principles (APPs), applicable in spirit now and mandatory once the small-business exemption is removed under the Privacy and Other Legislation Amendment Bill 2024 (phasing in 2026–2027), require:

| APP | Requirement | Implementation |
|---|---|---|
| **APP 1** Open management | Published privacy policy. | Build a `/privacy` page (one-time content task). |
| **APP 3** Collection limits | Collect only what's necessary. | Name + year (+ optional roll class). No DOB, no photo, no address, no gender. |
| **APP 5** Collection notice | Tell user why we're collecting at the point of collection. | One sentence under the "Add a child" form. |
| **APP 6** Use limits | Only use for the stated purpose. | Don't market to the child. Don't share beyond the school for fulfilment. |
| **APP 8** Cross-border | Disclose if data leaves AU. | One sentence in privacy notice (Neon is US-hosted). |
| **APP 11** Security | Reasonable steps — TLS, encryption at rest, access control. | Already in place. |
| **APP 12 / 13** Access & correction | Parent can view, edit, delete. | Edit/delete UI on the picker. |

**Lawful basis is cleanly available.** The parent voluntarily enters their own child's data into a third-party platform for a transactional purpose they initiate (purchasing uniform). That is "necessary for performing the contract / service" — the same lawful basis as a parent typing the kid's name on a Lowes Schoolwear checkout, except saved for re-use.

**Children-specific care:**
- "Reasonable steps" under APP 11 has a slightly higher bar for children's data (we already meet it via TLS + encrypted-at-rest Neon + access-controlled application code).
- Retention is tied to a meaningful event: 24 months after the parent's last paid order, or until parent-initiated delete, whichever is sooner.
- The forthcoming Children's Online Privacy Code is targeted at platforms collecting data *from* minors. Here, the *parent* is providing data *about* their own child, for a transaction they're conducting on the child's behalf — the lawful pattern, not the regulated one.

### School-side privacy obligations

- NSW public schools are subject to the Privacy and Personal Information Protection Act 1998 (NSW); independent and Catholic schools are subject to the APPs.
- Either way, schools cannot freely hand a third-party platform a roster of enrolled students without a Privacy Impact Assessment and a data-processing agreement.
- This is a hard wall against any verification feature that depends on the school's roster. We can't build it even if we wanted to.
- **Schools are unaffected by us storing parent-provided children's profiles** — that's a parent-to-platform data flow, not a school-to-platform one. We are not the school's data processor.

### What this means in practice

- **Verification is impossible.** We can't check enrolment without student data the school can't legally share.
- **Self-asserted gates are theatre.** A "code" or "token" only blocks confused parents, not bad actors — and there are virtually no bad actors.
- **Server-side storage of children's profiles, scoped to an authenticated parent, is lawful** with the APP requirements above. The compliance lift (privacy page, collection notice, edit/delete UI, retention rule) is modest and one-time.
- **Schools play no role** in the parent's account or kids list. They never see another parent's saved children; they only see paid orders that name a child for fulfilment.

---

## Why "lean" is the right answer for school-side gating

Three converging reasons school-side enrolment verification is the wrong posture:

1. **The platform is a shopfront, not a school portal.** Building school-mediated enrolment flows would make us a school-data processor — triggering DPAs per tenant, PIAs, and the kind of integration friction that's incompatible with our onboarding model. None of the schools we've talked with want it.

2. **Verification doesn't actually verify anything.** Even if we built it, the school would hand the link to anyone who asked at the front office. The "verification" would be theatre — only blocking confused parents who can't find the link.

3. **The school already has the right gate: payment + dashboard review.** They see paid orders. They fulfil what they want. They refund what they don't. That's the actual control point, and we already built it.

(Note: parent identity is a separate question. The platform does have parent accounts — see "v1 decision" table below — but that account is purely between the parent and the platform, scoped to their own purchasing convenience. It is not school-mediated and does not assert enrolment.)

---

## v1 decision: public-by-tenant-flag, real parent accounts, no enrolment verification

| Question | Answer |
|---|---|
| Does the school issue per-parent invitation links? | **No.** The tenant slug URL (`uniformorder.online/<slug>`) is the invitation. Schools share it through their existing channels (newsletter, enrolment pack, school website link). |
| Are schools listed publicly on uniformorder.online? | **Off by default**, opt-in via a tenant flag (`is_publicly_listed`). For v1, NSBH and RGHS both opt in. Schools that prefer URL-only entry can leave the flag off — they still work, just not browseable. |
| Does the parent prove they're enrolled? | **No.** Never. |
| Does the parent prove they're the child's parent? | **No.** They're a purchaser. The kid's name on the order is for school-side bagging, not identity. |
| What stops random people buying uniforms? | **Nothing — same as the physical shop.** It's a non-problem. |
| Branded / leadership-restricted items? | Future per-item `requires_staff_approval` flag → "we'll verify at collection" notice. **Not v1.** |
| Do parents have an account on the platform? | **Yes.** Magic-link email and Google sign-in via Neon Auth. The account is purely a purchasing convenience; it asserts no enrolment, no kinship, just "this email controls these saved profiles and orders". |
| Where do children's profiles live? | **In our database, scoped to the authenticated parent.** Lawful under APPs with the minimisation + notice + access/delete + retention requirements documented above. Children's names also continue to appear on order line items as commercial necessity. |
| What happens at the school's first launch? | School onboarding produces a tenant slug + Stripe Connect account + opt-in to public listing. School emails the slug URL to families. Parents land, sign in (or shop as guest first time), shop, pay. Done. |

---

## Implications for "Add another child" (`docs/remaining_work.md §3.3`)

The feature is a small CRUD experience scoped to the authenticated parent:

1. Parent signs in (magic-link or Google via Neon Auth) on first use; subsequent visits resume the session.
2. Parent taps the "Add another child" button on the picker.
3. Sheet opens: pick a publicly-listed tenant + enter child name + year (+ optional roll class). One-line collection notice tells them what we'll do with the data.
4. Saved to DB, scoped to their parent account. Appears in picker. Edit/remove available.

No invitation, no school-side token, no school staff in the loop.

The "child" label is UX copy — semantically what we're saving is a **purchaser shopping profile** ("who I tend to buy uniform for"), not a school enrolment record. This framing keeps the data model honest: the profile is purchaser-owned convenience that the parent can edit or delete at any time, not a school-asserted fact.

Implementation details (auth provider choice, schema, retention) live in the design spec for §3.3. This doc records the *legal posture*; the spec records the *implementation*.

---

## What we'd do differently if a school *did* ask for gating

If, post-launch, a tenant insists on access control:

1. **Static access code** (the Noone model) — set a `access_code` column on `tenants`, prompt for it on first visit to that tenant's URL, store the pass in cookies. Low effort, low friction, theatre but tolerable.
2. **Magic-link from school's parent portal** — the school links from their own parent portal with a signed query parameter; we accept it as a "this URL came from the school's authenticated portal" signal. Higher effort, only worth it if a school's portal already does authenticated parent log-in.
3. **Full identity** — only if regulated by a future policy change. Triggers PIA + DPA + the whole stack. Not in v1 or v2.

We do not pre-build any of these. Add when (if) a tenant asks.

---

## References

- `docs/remaining_work.md §3.3` — feature ticket the v1 decision unblocks.
- `my_doc/Legal/Refund_Policy/2026-05-07-refund-policy-ownership.md` — sister doc on the seller-of-record model under Stripe Connect; same school-as-tenant-as-seller framing.
- Australian Privacy Principles (APPs), Privacy Act 1988 (Cth).
- Privacy and Personal Information Protection Act 1998 (NSW) — for NSW public schools.
- OAIC guidance on children's data; Children's Online Privacy Code (in development).
