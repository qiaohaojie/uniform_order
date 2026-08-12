# UniformOrder User Manuals & Documentation Hub

Welcome to the **UniformOrder** official user manuals directory. UniformOrder is a modern, multi-tenant online uniform shop platform designed specifically for Australian schools, P&C (Parents & Citizens) committees, and school uniform operators.

To ensure every user gets clear, concise, and role-specific instructions, the documentation is divided into dedicated manuals based on user persona.

---

## 🧭 Persona Manual Navigation

Select the manual corresponding to your role:

| Persona | Description | Manual Link |
|---|---|---|
| 🛍️ **Parents & Families** | Ordering uniforms online, managing student profiles, tracking order fulfillment, and contacting the shop. | [**Parent User Manual**](Parent_User_Manual.md) |
| 🏫 **P&C & Shop Operators** | Managing orders, Kanban fulfillment, batch pick-slip printing, catalog editing, GST reports, and store settings. | [**P&C Operator Manual**](PNC_Operator_Manual.md) |
| 🛠️ **System Administrators** | Platform infrastructure, deployment, database management, tenant onboarding, Stripe Connect, and security. | [**System Administrator Manual**](SysAdmin_Manual.md) |

---

## ⚡ Quick System Overview

```
                      ┌──────────────────────────────────────────────┐
                      │            UniformOrder Platform             │
                      └──────────────────────┬───────────────────────┘
                                             │
      ┌──────────────────────────────────────┼──────────────────────────────────────┐
      ▼                                      ▼                                      ▼
┌───────────┐                          ┌───────────┐                          ┌───────────┐
│  Parent   │                          │ P&C Shop  │                          │ Platform  │
│   Shop    │                          │ Operator  │                          │ SysAdmin  │
└─────┬─────┘                          └─────┬─────┘                          └─────┬─────┘
      │                                      │                                      │
      ├─ Catalog & Garment Previews          ├─ Order Kanban & Fulfillment          ├─ Hostinger / Standalone Deployment
      ├─ Multi-Child Profile Assignment      ├─ Batch Pick-Slip Printing            ├─ Neon Postgres DB & Migrations
      ├─ Cart & Stripe Payment Element       ├─ Catalog & Size Guide Editor         ├─ Stripe Connect Onboarding
      └─ Live Pickup Tracking                ├─ BAS-Ready GST Reports               ├─ Platform Approval Console
                                             └─ Store Branding & Policy             └─ Security & Audit Event Logs
```

### Portal URLs & Access Points

| Component | Target URL / Route | Primary Audience |
|---|---|---|
| **School Selector / Home** | `https://uniformorder.online/` | Public / All Users |
| **Parent Uniform Shop** | `https://uniformorder.online/[tenant]` | Parents & Guardians |
| **School Admin Portal** | `https://uniformorder.online/admin/[tenant]` | P&C Operators & Volunteers |
| **Platform Console** | `https://uniformorder.online/platform` | Platform Super-Admins |

*(Note: Replace `[tenant]` with your school's unique slug, e.g. `imhs` for Illawarra Modern High School or `rgsh` for Riverside Academy).*

---

## 📚 Document Standards & Conventions

- **Concise & Direct**: Practical instructions organized with step-by-step procedures.
- **Accurate & Tested**: Reflects the production Next.js 16 App Router codebase and database schema.
- **Cross-Referenced**: Deep links between manuals and technical documentation for easy navigation.
