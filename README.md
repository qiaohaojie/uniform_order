# UniformOrder

**The online uniform shop for Australian schools and P&C committees.**

Parents order uniforms on their phone. Volunteers pack orders from a tablet. Money goes straight into the school’s bank account. No paper forms, no cash box, no end-of-term spreadsheet scramble.

**Website:** [uniformorder.online](https://uniformorder.online)

![UniformOrder open source launch](demo/launch_video/renders/uniformorder-open-source-launch.mp4)

---

## Who it’s for

| You are… | What UniformOrder does for you |
|---|---|
| **A parent** | Browse your school’s catalog, pick sizes with a guide, pay by card, and track when the order is ready for pickup. |
| **A P&C / uniform shop volunteer** | Receive paid orders, pack from a clear queue, print pick slips, and hand over a clean set of books at AGM. |
| **A school or business manager** | Each school has its own branded shop and bank payouts. Funds go to the school’s Stripe Connect account — not a shared pot. |
| **A platform operator** | Onboard new schools, approve catalogs, and see Connect status from one console. |

---

## Everyday scenarios

### Back-to-school rush

It’s the week before term. Dozens of families need shirts, shorts, and jumpers in different sizes for different kids.

**Without UniformOrder:** paper forms in bags, cash in envelopes, someone typing orders into a spreadsheet at night.

**With UniformOrder:** parents order from the school’s link on their phone. Volunteers open a packing board of *paid* orders only, print a batch of pick slips, and work through the queue. No chasing incomplete forms.

### One parent, two kids, two schools

Mum has one child at primary and one at high school. She signs in once, switches which child she’s shopping for, and keeps order history for both.

### Saturday packing morning

The coordinator opens the admin board on a tablet. Orders move through **paid → packing → ready → collected**. Each step is recorded. When a parent asks “where’s my order?”, the answer is on the board — not in someone’s memory.

### Treasurer at AGM

The Treasurer exports GST-aware CSV reports for BAS and the annual report. Card payments and payouts are in Stripe, tied to the school’s account. There’s an audit trail if anyone questions a refund or a missing order.

### Handover to next year’s committee

Next year’s coordinator inherits a live catalog, size guides, refund policy text, and a working order history — not a cardboard box of forms and a half-finished spreadsheet.

### New school coming on board

Platform staff create the tenant, set branding and legal text, connect Stripe, and approve the catalog before parents can buy. Schools only go live when they’re ready.

---

## What parents get

- **School-branded shop** — crest, colours, and the items *your* school actually sells  
- **Size guides** on the item page so fewer wrong-size returns  
- **Multi-child profiles** — one login, orders tagged to the right student  
- **Card checkout** via Stripe (no cash handling at the canteen window)  
- **Order tracking** — from paid through to ready for pickup  
- **Refund policy** shown and consented at checkout (school-controlled text or link)

Parents don’t install an app. They open the school’s link, sign in with email, and order.

---

## What shop operators get

- **Fulfilment board** — statuses for packing workflow, not a shared inbox  
- **Batch pick-slip print** — pack a list, not one order at a time from memory  
- **Catalog editor** — variants, sizes, guides, images; platform approval when needed  
- **Reports & CSV export** — GST-aware figures for the Treasurer and BAS  
- **Settings** — branding, contact, refund policy, shop email access  
- **Audit trail** — who changed what, when (protects volunteers as much as the school)

---

## Why committees choose it

| Pain today | How UniformOrder helps |
|---|---|
| Paper forms + cash | Online catalog and card payment |
| “Did we already pack this?” | Clear order statuses and pick slips |
| Saturday data entry | Orders arrive paid and complete |
| Handover chaos | System and history outlive any one volunteer |
| “Where did the money go?” | Stripe Connect payouts to the school’s account |
| AGM / BAS reporting | Exportable, GST-aware reports |

---

## How a school run works (high level)

1. **Parents** open the school’s shop link, choose items and sizes, pay online.  
2. **Operators** see new paid orders, pack them, mark ready, and hand over at pickup.  
3. **Funds** settle to the school’s connected Stripe account (optional platform fee).  
4. **Treasurer** exports reports when the books need closing.

For step-by-step instructions by role, see the [user manuals](docs/User_Manuals/README.md).

---

## Documentation

| Doc | Audience |
|---|---|
| [User manuals](docs/User_Manuals/README.md) | Parents, P&C operators, sysadmins |
| [Technical overview](docs/TECHNICAL.md) | Developers & contributors (stack, setup, architecture) |
| [Local development](docs/Deployment/LOCAL_DEVELOPMENT.md) | Running the monorepo on your machine |
| [Production deployment](docs/Deployment/PRODUCTION_DEPLOYMENT.md) | Hostinger / Neon / Stripe go-live |
| [Contributing](CONTRIBUTING.md) | PR expectations and local checks |
| [Security](SECURITY.md) | Vulnerability reporting |

---

## Status

Actively used for Australian school uniform shops. Demo data in this repo is synthetic. Production schools, Stripe live keys, and hosting config are managed outside the repository.

## License

[MIT](LICENSE) © 2026 PimSpace
