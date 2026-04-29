# Product Description Document (PDP)

**Project Name:** Uniform Online Order System
**Target Market:** Australian Schools (Initial Focus: New South Wales - NSW)
**Payment Provider:** Stripe Connect

---

## 1. Executive Summary

The Uniform Online Order System digitizes the traditional paper-based school uniform order form. By transitioning to a web-based e-commerce solution, schools can streamline their uniform shop operations, automate payment processing securely via Stripe Connect, and provide parents with a convenient, modern online shopping experience. This initial implementation will focus on New South Wales (NSW) schools, catering to their specific operational requirements and local tax regulations (GST).

## 2. Target Audience & Market

- **Primary Users (Parents/Guardians):** Need a fast, mobile-friendly way to order uniforms, track orders, and make secure payments.
- **Secondary Users (Uniform Shop Managers & School Administrators):** Need an easy-to-use dashboard to manage inventory, process orders, handle refunds/exchanges, and receive payouts.
- **Market Focus:** Australian schools, starting with the NSW region.

## 3. Core Features

### 3.1 Parent/Guardian Portal

- **Digital Order Form:** A user-friendly, step-by-step catalog replicating the paper form categorized by Summer, Winter, Sports, Blazers, Bags, and Miscellaneous.
- **Student Details Input:** Capture Student's Name, Roll Class/Year, Parent's Name, Mobile, and Email.
- **Cart & Checkout:** Persistent shopping cart, summarizing item sizes, quantities, unit prices, and the total amount (inclusive of GST).
- **Order Tracking:** Automated email notifications when orders are placed and when they are ready for pick-up from the School Office.

### 3.2 Administrator/Shop Operator Portal

- **Order Management Dashboard:** View, fulfill, and update the status of incoming orders.
- **Inventory Management:** Update stock levels, sizes, and pricing dynamically.
- **Tenant Management (Multi-Tenant):** Support for multiple schools (e.g., `nsbh`, `rgsh`) under a single platform.

### 3.3 Payments & Financials

- **Stripe Connect Integration:** Seamlessly route payments directly to the respective school's bank account.
- **Secure Checkout:** Replace manual credit card authorization (Visa/Mastercard paper forms) with a secure, PCI-compliant Stripe checkout.
- **GST Handling:** All prices include GST by default, conforming to Australian standards.

## 4. Product Catalog (Digitized form structure)

The online catalog will be structured precisely around the items from the original paper form:

- **Summer Uniform:** White shirts (short sleeve), Navy Shorts, School Caps, White/Sport socks.
- **Winter Uniform:** White shirts (long sleeve), Trousers (mid grey), Wool blend Jumpers, Belts, Grey socks, Ties, Zip Jackets, Scarves.
- **Sports Uniform:** Polo shirts, Soccer Jerseys, Navy Hoodies, Sports shorts, Track pants, Sports socks, Swimming briefs.
- **Blazers:** Navy with school crest (sized by chest cm).
- **Bags:** School backpacks and Sports bags.
- **Miscellaneous:** Calculators, Math Sets, Exercise books, Ring binders, Prefect Ties.

_Note: The platform will enforce refund/exchange policies directly at checkout (e.g., items must be in original packaging with tags; shirts cannot be refunded if opened)._

## 5. User Flow

1. **Selection:** Parent navigates to the school's unique URL (tenant).
2. **Browsing:** Parent selects items, sizes, and quantities.
3. **Information:** Parent enters student and contact details.
4. **Payment:** Parent is redirected to Stripe Checkout to securely process the Visa/Mastercard payment.
5. **Confirmation:** Parent receives an email receipt. Uniform shop receives an order notification.
6. **Fulfillment:** Shop prepares the order and updates the status to "Ready for Pick up". Parent receives a collection email.

## 6. Technical Stack & Implementation

- **Frontend:** Next.js 16 / React 19
- **Styling & Components:** Tailwind CSS v4 + HeroUI v3 (combining `@heroui/react` and `@heroui-pro/react` for complex layouts).
- **State Management:** LocalStorage for cart persistence (initially), scaling to a backend database.
- **Payments:** Stripe Connect API for multi-party payouts.

## 7. Future Roadmap

- **Phase 1 (MVP):** Next.js frontend with Stripe Checkout and local/static data representation. Focus on UI/UX using the established Design System.
- **Phase 2 (Backend & Auth):** Implement a PostgreSQL database to store orders, manage school tenants, and handle administrator authentication.
- **Phase 3 (Expansion):** Rollout to additional states beyond NSW, incorporating varying state-based school policies.
