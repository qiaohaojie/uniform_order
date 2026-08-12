# UniformOrder Documentation Index

Welcome to the **UniformOrder** documentation directory.

- Product overview and use cases: root [`README.md`](../README.md)
- Developer stack, setup, and architecture: [`TECHNICAL.md`](TECHNICAL.md)

---

## User Manuals by Persona

- [**User Manuals Hub**](User_Manuals/README.md)  
  Central directory and persona navigation hub for all UniformOrder user documentation.

  - 🛍️ [**Parent User Manual**](User_Manuals/Parent_User_Manual.md): Online store ordering, child profiles, cart & checkout, order tracking.
  - 🏫 [**P&C Operator Manual**](User_Manuals/PNC_Operator_Manual.md): Order fulfillment, Kanban status, pick-slip batch printing, catalog editor, GST reporting, store branding & settings.
  - 🛠️ [**System Administrator Manual**](User_Manuals/SysAdmin_Manual.md): Infrastructure, hostinger deployment, database setup, environment variables, platform tenant onboarding console, Stripe Connect, security & maintenance.

---

## Primary Guides

- [**Technical overview**](TECHNICAL.md)  
  Stack, monorepo layout, quick start, environment variables, security notes. Linked from the root README for developers.

- [**Local Development Guide**](Deployment/LOCAL_DEVELOPMENT.md)  
  Complete instructions for local environment setup, monorepo scripts, database migrations, and testing both the **Parent-Facing Shop** and **Admin-Facing Portal** locally.

- [**Production Deployment Guide**](Deployment/PRODUCTION_DEPLOYMENT.md)  
  Production deployment runbook for Hostinger Cloud Startup Node.js hosting, Neon Postgres (Sydney region), Stripe Connect live setup, environment variables reference, and verification checklists for both **Parent-Facing** and **Admin-Facing** applications.

---

## Applications Reference

- **Parent Shop (`apps/web/src/app/[tenant]`)**: Mobile-first uniform store for families (catalog, garment previews, cart, Stripe checkout, order confirmation).
- **School Admin Portal (`apps/web/src/app/admin/[tenant]`)**: Desktop operational portal for uniform shop staff and volunteers (Kanban fulfillment, pick-slip print generator, catalog editor, GST reports).
- **Platform Super-Admin (`apps/web/src/app/platform`)**: Platform management portal for tenant onboarding and approval.
- **Marketing Site (`apps/landing`)**: Astro-powered marketing and landing page.

