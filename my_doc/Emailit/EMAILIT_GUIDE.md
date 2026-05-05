# Emailit Integration Guide

A comprehensive, project-agnostic reference for sending transactional email via the Emailit REST API — with React Email for template authoring.

---

## What is Emailit?

[Emailit](https://emailit.com) is a transactional email delivery service. It exposes a simple REST API — no proprietary SDK required. You send emails with a single `POST` request authenticated by an API key.

---

## What is React Email?

[React Email](https://react.email) is a library for building email templates as React components. It handles the pain of email HTML compatibility: inline styles, table-based layout, and cross-client rendering — all through a familiar JSX authoring experience.

**Two packages are used together:**

| Package | Role |
|---|---|
| `@react-email/components` | JSX primitives (`Html`, `Body`, `Section`, `Text`, `Button`, etc.) |
| `@react-email/render` | Converts a React component tree to an HTML string (and optional plain text) |

---

## Account Setup

1. Sign up at [emailit.com](https://emailit.com)
2. Add and verify your sending domain (DNS records: SPF, DKIM, DMARC)
3. Create an API key from the dashboard
4. Set your verified domain as the sender address (e.g. `noreply@yourdomain.com`)

---

## Installation

```bash
npm install @react-email/components @react-email/render
# or
pnpm add @react-email/components @react-email/render
```

No Emailit SDK is needed — delivery is done via a plain `fetch` call.

---

## Environment Variables

```
EMAILIT_API_KEY=your_api_key_here
FROM_EMAIL=Your App <noreply@yourdomain.com>
```

Read them at call time, not at module load, so the app doesn't crash on startup if they're missing.

---

## Recommended File Structure

```
lib/email/
  client.ts           # sendEmail() — Emailit delivery layer
  index.ts            # send*Email() functions — fetch data, render, call sendEmail
  templates/
    WelcomeEmail.tsx  # React Email component
    ResetEmail.tsx    # React Email component
```

Keep the delivery layer (`client.ts`) separate from template orchestration (`index.ts`). This makes each layer independently testable.

---

## 1. Delivery Client (`client.ts`)

The client handles the Emailit API call, dev-mode fallback, timeout, and 4xx/5xx error splitting.

```ts
// lib/email/client.ts

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string } | null> {
  const apiKey = process.env.EMAILIT_API_KEY;
  const from = process.env.FROM_EMAIL || "Your App <noreply@yourdomain.com>";

  // Dev fallback — no key needed in local development
  if (!apiKey) {
    console.log(`[email:dev] To: ${to} | Subject: ${subject}`);
    return { id: "dev-mode-id" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // important in serverless

  try {
    const res = await fetch("https://api.emailit.com/v2/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const error = await res.text();
      if (res.status >= 400 && res.status < 500) {
        // 4xx = bad request (wrong address, invalid key, etc.) — do not retry
        console.error(`Emailit 4xx error (${res.status}): ${error}`);
        return null;
      }
      // 5xx = Emailit-side failure — throw so caller can decide to retry
      throw new Error(`Emailit 5xx error (${res.status}): ${error}`);
    }

    return await res.json(); // { id: string }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Emailit delivery error:", err);
    throw err;
  }
}
```

**Key decisions:**
- **Dev fallback** — returns a fake ID when `EMAILIT_API_KEY` is absent, so local development works without an account.
- **Timeout with AbortController** — serverless functions have tight execution limits; 5 s prevents hanging the request.
- **4xx vs 5xx split** — 4xx errors (e.g. invalid recipient) are logged and returned as `null`; 5xx errors are thrown so the caller can handle retries or alerting.

---

## 2. Writing Templates with React Email

Each template is a React component that accepts typed props and returns JSX using `@react-email/components` primitives.

```tsx
// lib/email/templates/WelcomeEmail.tsx

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps {
  userName: string;
  loginUrl: string;
}

export const WelcomeEmail = ({
  userName = "there",
  loginUrl = "#",
}: WelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Your App, {userName}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome, {userName}!</Heading>
          <Text style={text}>
            Your account is ready. Click below to sign in.
          </Text>
          <Section style={buttonSection}>
            <Link href={loginUrl} style={button}>
              Sign In
            </Link>
          </Section>
          <Text style={footer}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// Default export with preview defaults — required for the React Email dev server
export default WelcomeEmail;

// --- Inline styles (required for email client compatibility) ---
const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily: "-apple-system, sans-serif",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px",
  maxWidth: "600px",
};

const h1: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#1a1a1a",
};

const text: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.5",
  color: "#333333",
};

const buttonSection: React.CSSProperties = {
  textAlign: "center",
  margin: "24px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#0070f3",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "600",
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
};
```

**Rules for React Email templates:**
- All styles must be **inline objects** (`style={...}`), not class names — Gmail strips `<style>` blocks and external CSS.
- Use `@react-email/components` primitives (`Section`, `Row`, `Column`, `Text`, etc.) rather than raw HTML — they emit table-based layouts compatible with Outlook.
- Always include a `<Preview>` tag — this is the text shown in the inbox preview pane.
- Export a **named export** (used by your send functions) and a **default export** (used by the React Email dev server for visual preview).
- Provide **default prop values** on the default export — the dev server renders with no props.

### Available Primitives

| Component | Purpose |
|---|---|
| `Html` | Root document wrapper |
| `Head` | Metadata / charset |
| `Preview` | Inbox preview snippet |
| `Body` | `<body>` with background color |
| `Container` | Centered max-width wrapper |
| `Section` | Block-level section |
| `Row` / `Column` | Table-based multi-column layout |
| `Heading` | Semantic heading (`h1`–`h6`) |
| `Text` | Paragraph text |
| `Link` | Anchor tag |
| `Button` | Styled CTA button |
| `Hr` | Horizontal rule |
| `Img` | Hosted image (absolute URL required) |

---

## 3. Rendering Templates

Use `render()` from `@react-email/render` to convert a template to HTML or plain text.

```ts
import { render } from "@react-email/render";
import React from "react";
import { WelcomeEmail } from "./templates/WelcomeEmail";

const props = { userName: "Alice", loginUrl: "https://example.com/login" };

// Full HTML email
const html = await render(React.createElement(WelcomeEmail, props));

// Plain text fallback (same component, different render option)
const text = await render(React.createElement(WelcomeEmail, props), {
  plainText: true,
});
```

Both `html` and `text` are then passed directly to `sendEmail()`. The same template source produces both — no separate plain text file to maintain.

---

## 4. Orchestration Layer (`index.ts`)

The orchestration layer fetches any data needed, builds props, renders both versions, calls `sendEmail`, and handles errors.

```ts
// lib/email/index.ts

import { render } from "@react-email/render";
import React from "react";
import { sendEmail } from "./client";
import { WelcomeEmail } from "./templates/WelcomeEmail";

export async function sendWelcomeEmail(userId: string) {
  // 1. Fetch whatever data the template needs
  const user = await getUserById(userId);
  if (!user) return;

  // 2. Build typed props
  const props = {
    userName: user.name,
    loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
  };

  // 3. Render HTML and plain text from the same component
  const html = await render(React.createElement(WelcomeEmail, props));
  const text = await render(React.createElement(WelcomeEmail, props), {
    plainText: true,
  });

  // 4. Send — fire and forget (don't block the user action on email failure)
  try {
    const result = await sendEmail({
      to: user.email,
      subject: `Welcome to Your App, ${user.name}!`,
      html,
      text,
    });
    if (result?.id) {
      console.log(`Welcome email sent to ${user.email}, ID: ${result.id}`);
    }
  } catch (err) {
    console.error("Failed to send welcome email:", err);
    // Do not re-throw — email failure should not break the user action
  }
}
```

---

## 5. Idempotency — Stamp on Success

For any email that must be sent exactly once (order confirmations, payment receipts), implement "stamp on success": only write the sent timestamp **after** the Emailit API returns a success `id`. If the process crashes between sending and stamping, the email may be sent twice — which is safer than a missed email.

```ts
// Pseudocode — adapt to your database/storage layer

export async function sendOrderConfirmationEmail(orderId: string) {
  const order = await getOrderById(orderId);
  if (!order) return;

  // Guard: skip if already stamped
  if (order.emailsSent?.confirmation) return;

  const html = await render(React.createElement(OrderConfirmationEmail, buildProps(order)));
  const text = await render(React.createElement(OrderConfirmationEmail, buildProps(order)), {
    plainText: true,
  });

  const result = await sendEmail({
    to: order.email,
    subject: `Order Confirmation #${order.id}`,
    html,
    text,
  });

  // Only stamp after confirmed delivery
  if (result?.id) {
    await markEmailSent(orderId, "confirmation", {
      sentAt: new Date().toISOString(),
      messageId: result.id,
    });
  }
}
```

**Why stamp-on-success:**
- Stamping before the API call means a crash between stamp and send leaves the order silently unnotified.
- Stamping after means worst-case is a duplicate email on retry — always preferable to a missed one.
- The guard at the top makes the function safe to call multiple times (idempotent from the caller's perspective).

---

## 6. Visual Preview with the React Email Dev Server

React Email ships a local dev server that renders templates in the browser as you edit them.

```bash
npx react-email dev --dir ./lib/email/templates --port 3001
```

Visit `http://localhost:3001` to preview all templates side-by-side with live reload.

**Requirements for the dev server:**
- Each template file must have a **default export** (the component).
- Default prop values must be set so the server can render without data.
- The `--dir` path must point to your templates folder.

---

## Patterns Reference

### Fire-and-forget (non-critical emails)

Catch errors without re-throwing so a failed email never blocks the user-facing response:

```ts
try {
  await sendEmail({ to, subject, html, text });
} catch (err) {
  console.error("Email failed:", err);
  // do NOT re-throw
}
```

### Throw for auth-critical emails

For magic links, password resets, or email verification — let the error propagate so the caller can surface a failure message to the user:

```ts
const result = await sendEmail({ to, subject, html, text });
if (!result) throw new Error("Failed to send verification email");
```

### Always send both HTML and text

```ts
const html = await render(React.createElement(MyTemplate, props));
const text = await render(React.createElement(MyTemplate, props), { plainText: true });

await sendEmail({ to, subject, html, text });
```

### Log the Emailit message ID

Every successful send returns `{ id: string }`. Log it — it's your reference for debugging delivery issues with Emailit support:

```ts
const result = await sendEmail({ ... });
if (result?.id) {
  console.log(`Email sent, Emailit ID: ${result.id}`);
}
```

---

## HTML Email Best Practices (applies to React Email templates too)

- **Inline styles only** — no `<style>` blocks, no external CSS. Gmail strips them.
- **Use React Email primitives** — they output table-based layout, which Outlook requires.
- **No JavaScript** — email clients strip all scripts.
- **No SVG** — use `<Img>` with absolute hosted URLs (`https://...`).
- **Always include `<Preview>`** — the inbox snippet that drives open rates.
- **Max width ~600px** — renders well on both desktop and mobile.
- **Test in multiple clients** — Gmail, Apple Mail, and Outlook render differently. Tools like Litmus or Email on Acid help.

---

## Quick Reference

```
Packages:   @react-email/components   @react-email/render
Templates:  lib/email/templates/*.tsx  (named + default export, inline styles)
Render:     render(React.createElement(Template, props))
Plain text: render(React.createElement(Template, props), { plainText: true })
Send:       sendEmail({ to, subject, html, text })   →   { id: string } | null
Dev server: npx react-email dev --dir ./lib/email/templates
```
