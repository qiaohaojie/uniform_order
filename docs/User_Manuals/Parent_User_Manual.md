# Parent & Family User Manual

This manual is for **Parents, Guardians, and Families** purchasing school uniforms online through UniformOrder.

---

## 📋 Table of Contents

1. [Accessing Your School Uniform Shop](#1-accessing-your-school-uniform-shop)
2. [Managing Student & Child Profiles](#2-managing-student--child-profiles)
3. [Browsing the Catalog & Selecting Garments](#3-browsing-the-catalog--selecting-garments)
4. [Shopping Cart Management](#4-shopping-cart-management)
5. [Checkout & Secure Payment](#5-checkout--secure-payment)
6. [Order Confirmation & Pickup Instructions](#6-order-confirmation--pickup-instructions)
7. [Order Tracking & Purchase History](#7-order-tracking--purchase-history)
8. [Returns, Exchanges & Support](#8-returns-exchanges--support)

---

## 1. Accessing Your School Uniform Shop

### Access Methods
You can access your school's online uniform shop in two ways:

1. **School Selector Portal**: Visit `https://uniformorder.online/` and search for or select your school from the list.
2. **Direct School Web Address**: Go directly to your school's custom web address:
   `https://uniformorder.online/[school-slug]`  
   *(Example: `https://uniformorder.online/imhs` for Illawarra Modern High School or `https://uniformorder.online/rgsh` for Riverside Academy).*

```
┌────────────────────────────────────────────────────────────────────────┐
│ UNIFORM ORDER · SCHOOL PICKER                                          │
├────────────────────────────────────────────────────────────────────────┤
│ Search School: [ Illawarra Modern High                           ]     │
│                                                                        │
│ 🏫 Illawarra Modern High School (IMHS)    [ Open Shop ➔ ]             │
│ 🏫 Riverside Academy (RGSH)               [ Open Shop ➔ ]             │
└────────────────────────────────────────────────────────────────────────┘
```

### Device Compatibility
The shop is mobile-first and fully responsive. You can order on any device:
- Apple iPhone / Android smartphones
- iPad / Android tablets
- Mac / Windows desktop web browsers

---

## 2. Managing Student & Child Profiles

UniformOrder allows parents to manage multiple children under one account, eliminating repetitive data entry when placing orders across different year groups.

### Adding a Child Profile
1. Click **"Sign In"** at the top right of the screen (or access `/profile`).
2. Sign in using your email address (via Magic Link or Google Sign-In).
3. Under **My Children**, click **"Add Child"**.
4. Enter child details:
   - **Child's Full Name**: e.g., *Oliver Smith*
   - **School Year / Grade**: Select from Kindergarten to Year 12.
   - **Roll Class / Homeroom**: e.g., *7B* or *10 BLUE*.
5. Click **"Save Child"**.

```
┌────────────────────────────────────────────────────────────────────────┐
│ ADD / EDIT CHILD PROFILE                                               │
├────────────────────────────────────────────────────────────────────────┤
│ Student Name: [ Oliver Smith                                         ] │
│ School Year:  [ Year 7                                             ▼ ] │
│ Roll Class:   [ 7B                                                   ] │
│                                                                        │
│               [ Cancel ]                     [ Save Profile ]          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Browsing the Catalog & Selecting Garments

### Catalog Navigation & Filtering
When you open your school shop (`/[tenant]`), the catalog is organized for easy browsing:
- **Category Tabs**: Filter garments by *Summer*, *Winter*, *Sports*, *Formal*, *Bags*, or *Accessories*.
- **Search Bar**: Type garment names (e.g., *Blazer*, *Polo*, *Track Pants*).

```
┌────────────────────────────────────────────────────────────────────────┐
│ ILLAWARRA MODERN HIGH SCHOOL UNIFORM SHOP                              │
├───────────┬───────────┬───────────┬───────────┬───────────┬────────────┤
│  All (18) │ Summer(6) │ Winter(5) │ Sports(4) │ Formal(2) │ Bags(1)    │
└───────────┴───────────┴───────────┴───────────┴───────────┴────────────┘
```

### Viewing Garment Details & Size Guides
Click any item card to open the garment detail view:
- **Garment Preview**: High-resolution image or official school color vector artwork.
- **Price Display**: Prices are in Australian Dollars ($AUD) including GST.
- **Size Selector**: Select desired size (e.g., Size 8, Size 10, Medium, Large).
- **Interactive Size Guide**: Click **"Size Guide"** to open measurement charts (Chest, Waist, Length in cm) to select the right fit.

---

## 4. Shopping Cart Management

### Assigning Items to Children
When adding an item to your cart, you can assign it to a specific child profile:
- This ensures the P&C uniform shop packages garments correctly labelled for each student.

```
┌────────────────────────────────────────────────────────────────────────┐
│ YOUR CART (3 Items)                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ 👕 Junior Boys Short Sleeve Shirt (Size 10)               $38.00       │
│    For: Oliver Smith (Year 7, 7B)    Qty: [ - ] 2 [ + ]   [ Remove ]   │
│                                                                        │
│ 🧥 Unisex Fleece Zip Hoodie (Size 12)                     $55.00       │
│    For: Emma Smith (Year 9, 9R)      Qty: [ - ] 1 [ + ]   [ Remove ]   │
├────────────────────────────────────────────────────────────────────────┤
│ Subtotal (incl. GST):                                    $131.00       │
│                                                    [ Checkout ➔ ]     │
└────────────────────────────────────────────────────────────────────────┘
```

### Modifying Your Cart
- Adjust item quantities using the `+` and `-` buttons.
- Click **"Remove"** to delete an item.
- Your cart is automatically saved in your browser (`uo:cart:v1`), so you won't lose items if you reload the page.

---

## 5. Checkout & Secure Payment

Click **"Checkout"** from the cart to enter the secure checkout flow (`/[tenant]/checkout`).

```
┌────────────────────────────────────────────────────────────────────────┐
│ SECURE CHECKOUT                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. PARENT CONTACT DETAILS                                              │
│    Full Name: [ Sarah Smith                ]                           │
│    Email:     [ sarah.smith@example.com    ]                           │
│    Mobile:    [ 0412 345 678               ]                           │
│                                                                        │
│ 2. FULFILLMENT METHOD                                                  │
│    (X) School Uniform Shop Pickup (Free)                               │
│                                                                        │
│ 3. SPECIAL INSTRUCTIONS (OPTIONAL)                                     │
│    [ Student will pick up during Tuesday recess                       ]│
│                                                                        │
│ 4. REFUND & EXCHANGE POLICY CONSENT                                    │
│    [X] I have read and agree to the IMHS Uniform Shop Refund Policy.   │
│                                                                        │
│ 5. PAYMENT DETAILS (Stripe Secure)                                    │
│    Card Number:  [ 4242 •••• •••• 4242 ]  Exp: [ 12/28 ]  CVC: [ 123 ]│
│                                                                        │
│                        [ Pay $131.00 Now ]                             │
└────────────────────────────────────────────────────────────────────────┘
```

### Checkout Steps
1. **Parent Contact Info**: Enter Parent Name, Email Address, and Mobile Number. (Auto-filled if logged in).
2. **Student & Fulfillment Confirmation**: Confirm pickup method and child profile details.
3. **Special Instructions**: Enter notes for uniform shop staff if needed.
4. **Refund Policy Agreement**: Review the school's official refund and exchange policy and check the agreement box.
5. **Secure Payment**: Enter credit/debit card details (Visa, Mastercard, AMEX) or pay via Apple Pay / Google Pay. Payments are processed securely via **Stripe Connect**.
6. Click **"Pay Now"**.

---

## 6. Order Confirmation & Pickup Instructions

Upon successful payment, the Order Confirmation screen displays your receipt and collection instructions.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🎉 ORDER CONFIRMED!                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ Order Reference: IMHS-04298                                            │
│ Total Paid:       $131.00 (incl. $11.91 GST)                           │
│ Status:           Paid (Sent to shop for packing)                      │
│                                                                        │
│ 📍 COLLECTION INSTRUCTIONS                                             │
│ Location: IMHS Uniform Shop, Building B (near main office)             │
│ Hours:    Tuesdays & Thursdays, 8:00 AM – 11:30 AM                     │
│ Note:     You will receive an email as soon as your order is packed!   │
└────────────────────────────────────────────────────────────────────────┘
```

### Confirmation Email
- A tax invoice and order summary is immediately sent to your email address.
- Retain your **Order Reference ID** (e.g. `IMHS-04298`) for collection.

---

## 7. Order Tracking & Purchase History

Track active orders or view past purchase history at any time.

### Order Status Stages

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    PAID     │ ──► │   PACKING   │ ──► │    READY    │ ──► │  COLLECTED  │
│ Order Rec'd │     │ In Prep     │     │ Email Sent  │     │ Order Done  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Paid**: Order received and queued for uniform shop volunteers.
2. **Packing / In Prep**: Shop staff are picking and packing your items.
3. **Ready for Pickup**: Order is packed! An email notification has been sent. You can collect your order during shop hours.
4. **Collected**: Order handed over and completed.

### Viewing Order History
- Navigate to `https://uniformorder.online/orders` while logged in.
- View status badges, item details, and download digital tax receipts for all current and past orders across all your children.

---

## 8. Returns, Exchanges & Support

### School Refund & Exchange Policy
Uniform shops operated by P&C committees adhere to Australian Consumer Law (ACL) and individual school policies:
- **Exchanges**: Unworn garments with tags attached can generally be exchanged for different sizes at the uniform shop counter during opening hours.
- **Faulty Items**: Garments with manufacturing defects will be replaced or refunded promptly.

### Contacting Your Uniform Shop
If you have questions about your order:
1. Locate the shop contact email on your order confirmation page or email receipt.
2. Quote your **Order Reference ID** (e.g., `IMHS-04298`) and **Student Name** in your message.

---

*Thank you for supporting your school's P&C committee through UniformOrder!*
