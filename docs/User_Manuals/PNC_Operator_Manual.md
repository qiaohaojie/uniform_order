# P&C & Uniform Shop Operator User Manual

This manual is for **Parents & Citizens (P&C) Committee Members, Uniform Shop Managers, Staff, and Volunteers** who manage daily uniform shop operations, process orders, maintain item catalogs, export financial reports, and configure store settings.

---

## 📋 Table of Contents

1. [System Access & Authentication](#1-system-access--authentication)
2. [Operational Dashboard](#2-operational-dashboard)
3. [Order Fulfillment & Kanban Board](#3-order-fulfillment--kanban-board)
4. [Batch Pick-Slip Printing](#4-batch-pick-slip-printing)
5. [Customer Communications & Transactional Email](#5-customer-communications--transactional-email)
6. [Catalog & Inventory Management](#6-catalog--inventory-management)
7. [Financial Reports, GST & BAS Compliance](#7-financial-reports-gst--bas-compliance)
8. [Store Branding & Settings](#8-store-branding--settings)
9. [Troubleshooting & Frequently Asked Questions](#9-troubleshooting--frequently-asked-questions)

---

## 1. System Access & Authentication

### Access URL
Navigate to your school's dedicated administration URL:
`https://uniformorder.online/admin/[tenant]`  
*(Example: `https://uniformorder.online/admin/imhs` for Illawarra Modern High School or `https://uniformorder.online/admin/rgsh` for Riverside Academy).*

### Authentication Requirements
- Access is email-gated. The email address used to sign in must match the school's configured `shop_email` or be an authorized operator account.
- Sign in using **Neon Auth** via Magic Link or Google Workspace OAuth.
- Once authenticated, an active session cookie secures access to all administrative routes under `/admin/[tenant]`.

---

## 2. Operational Dashboard

The Dashboard (`/admin/[tenant]/dashboard`) provides a real-time operational overview of the uniform shop.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ILLAWARRRA MODERN HIGH SCHOOL · OPERATOR DASHBOARD                                     │
├───────────────────┬───────────────────┬───────────────────┬────────────────────────┤
│ Orders to Prepare │  Ready for Pickup │ Completed (Month) │ Gross Sales (30 Days)  │
│        14         │         8         │        142        │       $12,480.00       │
└───────────────────┴───────────────────┴───────────────────┴────────────────────────┘
```

### Key Metrics
- **To Prepare**: Orders paid by parents that require physical packing in the shop.
- **Ready for Pickup**: Packed orders awaiting parent collection.
- **Completed**: Orders successfully collected or delivered in the active period.
- **Gross Sales & GST**: Financial overview of active sales volume.

### System Alerts
- **Needs Attention**: Highlights orders placed on hold (e.g., stock shortage, missing size details).
- **Stripe Connect Status**: Alerts if Stripe account onboarding or compliance updates are required to accept funds.

---

## 3. Order Fulfillment & Kanban Board

The Order Management interface (`/admin/[tenant]/orders`) utilizes a visual Kanban board to track and update order status cleanly.

### Fulfillment Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  To Prepare  │ ──► │    Ready     │ ──► │  Completed   │ OR  │ Needs Attention  │
│ (Newly Paid) │     │ (Email Sent) │     │ (Collected)  │     │      (Hold)      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────────┘
```

| Status | Description | Action Required |
|---|---|---|
| **To Prepare** (`to_prepare`) | Order paid by parent, pending packing. | Print pick slip, assemble items into bag, attach label. |
| **Ready for Pickup** (`ready`) | Order packed and placed in pickup area. | Click **"Mark Ready"**. Automatically triggers pickup email to parent. |
| **Completed** (`completed`) | Student/parent collected uniform. | Click **"Mark Collected"**. Archives order. |
| **Needs Attention** (`needs_attention`) | Order encountered issue (e.g. out of stock). | Move to Hold, enter internal note, contact parent. |

### Searching & Filtering
- **Search Bar**: Query by **Order Reference ID** (e.g. `IMHS-04298`), **Parent Name**, **Student Name**, or **Roll Class**.
- **Filter Tabs**: Toggle between *All Orders*, *To Prepare*, *Ready*, *Completed*, or *Needs Attention*.

### Order Details Drawer
Clicking any order card opens the full Order Details Drawer:
- **Customer & Student Details**: Parent name, email, mobile phone, student name, year group, roll class.
- **Line Items**: Item name, variant/size, quantity, unit price, line total.
- **Customer Note**: Special instructions supplied by parent during checkout.
- **Financial Breakdown**: Subtotal, GST, Delivery Fee, Total Paid, Stripe Reference ID.
- **Audit Trail & Log**: Timestamped history of status transitions, emails sent, and printed pick slips.
- **Re-open Order**: Allows operators to return a completed order back to `To Prepare` if an adjustment is required.

---

## 4. Batch Pick-Slip Printing

To streamline physical packing during shop hours, operators can generate batch pick slips.

### Steps to Print Pick Slips
1. Open the Order Board (`/admin/[tenant]/orders`).
2. Filter or navigate to the **To Prepare** column.
3. Click **"Print Pick Slips"** at the top right of the column.
4. The system opens a print-formatted view grouping orders with:
   - Order ID barcode/header
   - Student Name, Year, and Roll Class
   - Itemized list of garments, sizes, and quantities
   - Collection instructions & customer notes
5. Print to your standard shop printer or label printer.
6. Printing automatically records the `pick_slip_printed_at` timestamp and operator ID in the audit log.

---

## 5. Customer Communications & Transactional Email

UniformOrder handles automated email notifications via **Emailit** to minimize parent inquiries.

### Automated Notifications

| Event | Recipient | Content |
|---|---|---|
| **Order Paid** | Parent Email | Order confirmation, itemized receipt, order ID, estimated preparation time. |
| **Marked Ready** | Parent Email | Pickup notification, uniform shop location, opening hours, collection instructions. |
| **Order On Hold** | Parent Email | Notification of delay/issue with instructions to contact the shop. |
| **Refund Issued** | Parent Email | Refund confirmation, refunded line items, amount returned to card. |

### Manual Resend & Status Tracking
- Operators can view notification status (`Queued`, `Sent`, `Failed`) inside the Order Details Drawer.
- Click **"Resend Ready Email"** if a parent requests a duplicate notification.

---

## 6. Catalog & Inventory Management

Manage the uniform shop's product offerings via `/admin/[tenant]/catalog`.

> ⚠️ **Note**: If tenant status is pending platform approval, catalog editing will show a *Pending Approval* banner until platform admins verify Stripe compliance.

### Adding & Editing Catalog Items

```
┌────────────────────────────────────────────────────────────────────────┐
│ CATALOG ITEM EDITOR                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ Item Name:   [ Boys Short Sleeve Shirt                               ] │
│ Category:    [ Summer Uniform                                      ▼ ] │
│ Sort Order:  [ 10  ]   Active: [X] Visible in parent shop              │
│ Description: [ Durable poly-cotton blend with embroidered crest.      ] │
└────────────────────────────────────────────────────────────────────────┘
```

1. Click **"Add Item"** or click an existing item card.
2. Configure core fields:
   - **Name**: Clear garment title (e.g. *Junior Unisex Fleece Hoodie*).
   - **Category**: Select from *Summer*, *Winter*, *Sports*, *Formal*, *Bags*, or *Accessories*.
   - **Description**: Material details, care instructions, embroidered crest notes.
   - **Sort Order**: Integer controlling grid position in parent shop.
   - **Active Toggle**: Enable or disable public visibility without deleting the item.

### Managing Sizes & Prices (Variants)
Each product item supports multiple size variants:
- **Variant Label**: e.g., `Size 4`, `Size 6`, `Size 8`, `Small`, `Medium`, `Large`.
- **Price**: Enter selling price in AUD (e.g. `45.00`). GST (10%) is calculated automatically.
- **Active Variant**: Toggle individual sizes on/off based on stock availability.

### Garment Images
- **Upload Image**: Upload high-resolution product photos directly via UploadThing.
- **Vector Fallback**: If no custom image is uploaded, the app automatically renders dynamic SVG garment previews matching item type and school accent color.

### Size Guide Builder
Maintain accurate sizing reference charts for parents:
- Define measurement units (e.g. `cm` or `inches`).
- Set table columns: e.g., `Size`, `Chest (cm)`, `Waist (cm)`, `Length (cm)`.
- Input size rows to render interactive sizing charts on the parent product page.

---

## 7. Financial Reports, GST & BAS Compliance

Access live financial reports and BAS compliance data at `/admin/[tenant]/reports`.

```
┌────────────────────────────────────────────────────────────────────────┐
│ BAS-READY GST SUMMARY TABLE                                            │
├────────────┬─────────────┬───────────────┬─────────────┬───────────────┤
│ Period     │ Gross Sales │ GST Collected │ Net ex-GST  │ Net Payout    │
├────────────┼─────────────┼───────────────┼─────────────┼───────────────┤
│ Q1 (Jul-Sep│  $18,450.00 │     $1,677.27 │  $16,772.73 │    $18,044.10 │
│ Q2 (Oct-Dec│  $24,120.00 │     $2,192.73 │  $21,927.27 │    $23,589.36 │
└────────────┴─────────────┴───────────────┴─────────────┴───────────────┘
```

### Key Financial Views
- **Summary Cards**: Total Revenue, Total Orders, Average Order Value (AOV), Total Remittable GST.
- **Monthly Revenue Chart**: Visual trend bar chart of sales performance over 6 or 12 months.
- **Category Breakdown**: Percentage distribution of revenue (e.g. 45% Winter, 35% Summer, 20% Sports).
- **BAS-Ready GST Table**:
  - Gross Sales (incl. GST)
  - GST Collected (1/11th of total gross)
  - Net Sales (ex-GST)
  - Stripe Merchant Processing Fees
  - Net Bank Payout

### Exporting Accounting Data
- Click **"Export CSV"** to download `[tenant]-gst-report.csv`.
- CSV output is structured for direct import into accounting systems (**Xero**, **MYOB**, or **Excel**).

---

## 8. Store Branding & Settings

Configure uniform shop details and policies under `/admin/[tenant]/settings`.

### Store Profile & Branding
- **School Name & Short Name**: Publicly displayed in parent shop headers.
- **Accent Color**: Hex code (e.g. `#7A1F2B`) driving button styles, banners, and vector garment previews.
- **Logo URL**: Upload school crest/logo. (If omitted, a stylized crest using school initials is rendered).

### Operations & Pickup Instructions
- **Shop Email & Mobile**: Contact details provided to parents on receipts.
- **Physical Address & Hours**: e.g., *Building B, open Tuesdays 8:00 AM – 11:30 AM*.
- **Collection Instructions**: Custom message shown to parents upon order completion (e.g., *"Please present your Order Reference ID at the uniform shop counter during opening hours"*).

### Workflow Mode
- **Standard Mode**: Full `To Prepare` → `Ready` → `Completed` flow with pickup notification email.
- **Simple Mode**: Streamlined `To Prepare` → `Completed` flow for immediate over-the-counter fulfillment.

### Legal Refund Policy & Compliance
UniformOrder enforces versioned legal refund policy compliance:
- **Policy Mode**: Choose between raw text (`text`) or external link (`url`).
- **Policy Text / URL**: Enter the school's official refund & exchange policy.
- **Declarant Details**: Enter Declarant Name and Role (e.g. *Jane Doe, P&C President*).
- **Consents**: Acknowledge Australian Consumer Law (ACL) compliance and Seller of Record obligations.
- Saving updates increments the policy version to ensure all parent checkouts consent to active legal terms.

### Stripe Connect Account Status
- Displays live status of school bank account connection (`Charges Enabled`, `Payouts Enabled`).
- Click **"Manage Stripe Account"** to update P&C committee banking details or representative info directly in Stripe.

---

## 9. Troubleshooting & Frequently Asked Questions

### Q1: A parent says they didn't receive their pickup email.
- **Solution**: Open `/admin/[tenant]/orders`, search by parent email or order ID, open the Order Details Drawer, verify email delivery status, and click **"Resend Ready Email"**. Check that the parent's email address contains no typos.

### Q2: An item size is out of stock. How do I stop parents from ordering it?
- **Solution**: Go to `/admin/[tenant]/catalog`, click the product item, locate the size variant under **Variants**, and toggle the switch to **Inactive**. Click **Save**. The size will immediately show as unavailable in the parent shop.

### Q3: A parent needs to exchange an item for a different size after ordering.
- **Solution**: Open the order in the Kanban board, add an internal operator note detailing the exchange (e.g., *Exchanged Size 8 for Size 10 in person on 14/08*), and update status as appropriate.

### Q4: How do I issue a refund?
- **Solution**: Open the Order Details Drawer, select **Issue Refund**, choose full or partial refund amount, enter reason, and confirm. The refund is processed securely through Stripe Connect directly back to the parent's payment card.

---

*For technical issues or platform onboarding inquiries beyond shop management, contact platform support at support@uniformorder.online.*
