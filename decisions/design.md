# Decisions — design

> Auto-routed shard of the decision log (see `../DECISION.md`). New entries
> appended by `.gq-spec/log-decision.sh`. Find any decision via
> `decisions/INDEX.md` or `grep -r <term> decisions/`.

## Preloved Phase 1 is donation-only
- **ID:** e476bc31-9243-443c-aa02-323d76245cbb
- **Date:** 2026-09-06T12:29:05Z
- **Stage:** design
- **Decision:** Phase 1 of second-hand support is a P&C donation-only preloved rack inside the existing shop. Parents drop washed current-uniform items; operators inspect, price, and list; other parents buy in the same cart and collect at pickup. Consignment is Phase 2 only if schools ask. Parent-to-parent marketplace is out of scope.
- **Why:** Copies the common Australian school-shop practice (PLC Sydney, Manly, Vardys Road, West Pymble). Lowest volunteer load. UniformOrder is already the school as seller of record. C2C platforms already exist outside this product.
- **Alternatives:** B: donation + consignment in the first build. C: parent-to-parent marketplace with listings/escrow.
- **Pros:** Matches donation-first shops; no bank details or payout CSV in v1; GST-free path is only for gifted stock.
- **Cons:** Schools that still run Tara/CCGS paper consignment will keep using paper until Phase 2.
- **Risks / known issues:** GST-free remains tenant-declared (default off). Hats stay on the refuse list until a tenant turns them on — those two defaults were not separately confirmed.
- **Links:** docs/second-hand/plan-preloved-shop.md; docs/second-hand/research-australian-second-hand-uniform-trading.md

## Preloved Phase 1 sequenced as M01–M06
- **ID:** 42680fa4-5c25-49b5-bc92-9173a830072b
- **Date:** 2026-09-06T12:38:07Z
- **Stage:** design
- **Decision:** Split donation-only preloved rack into M01 schema/settings; M02 mixed-cart GST; M03 operator intake/write-off; M04 donate page + refund policy; M05 parent catalogue/cart; M06 paid decrement + PRELOVED pick slip. Waves: M01 then parallel M02/M03/M04 then M05 then M06. No consignment milestone.
- **Why:** Sequencing only from specs/context/plan-preloved-shop.md §11 P1–P6. P4 and P5 kept separate so donate/refund can ship in Wave 2 without waiting on catalogue. M03 must not share reports/totals files with M02.
- **Alternatives:** Combine P4+P5 into one parent milestone (more layout coupling, donate waits on GST). Fully serial P1–P6 (loses Wave 2 parallelism). Include Phase 2 consignment as M07 (contradicts approved scope).

