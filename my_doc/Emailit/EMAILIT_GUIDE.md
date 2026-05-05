# Emailit Integration Guide

A comprehensive, project-agnostic reference for sending transactional email via the Emailit REST API.

---

## What is Emailit?

[Emailit](https://emailit.com) is a transactional email delivery service. It exposes a simple REST API — no proprietary SDK required. You send emails with a single `POST` request authenticated by an API key.

---

## Account Setup

1. Sign up at [emailit.com](https://emailit.com)
2. Add and verify your sending domain (DNS records: SPF, DKIM, DMARC)
3. Create an API key from the dashboard
4. Set your verified domain as the sender address (e.g. `noreply@yourdomain.com`)

---

## Environment Variables

```
EMAILIT_API_KEY=your_api_key_here
FROM_EMAIL=Your App <noreply@yourdomain.com>   # optional, can hardcode a default
```

Read them at call time, not at module load, so the app doesn't crash on startup if they're missing:

```ts
const EMAILIT_API_KEY = process.env.EMAILIT_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "Your App <noreply@yourdomain.com>";
```

---

## Core API Call

**Endpoint:** `POST https://api.emailit.com/v2/emails`

**Auth:** Bearer token in the `Authorization` header.

```ts
async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const EMAILIT_API_KEY = process.env.EMAILIT_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || "Your App <noreply@yourdomain.com>";

  if (!EMAILIT_API_KEY) {
    console.error("EMAILIT_API_KEY not configured");
    return;
  }

  const response = await fetch("https://api.emailit.com/v2/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EMAILIT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Emailit error ${response.status}: ${error}`);
  }

  const result = await response.json();
  console.log(`Email sent to ${to}, ID: ${result.id}`);
}
```

### Request Body Fields

| Field     | Type   | Required | Notes                                          |
|-----------|--------|----------|------------------------------------------------|
| `from`    | string | Yes      | Must be a verified sender domain               |
| `to`      | string | Yes      | Recipient address. Can also be an array.       |
| `subject` | string | Yes      |                                                |
| `html`    | string | No*      | At least one of `html` or `text` is required  |
| `text`    | string | No*      | Plain text fallback — always include this      |
| `cc`      | string | No       | CC addresses                                   |
| `bcc`     | string | No       | BCC addresses                                  |
| `reply_to`| string | No       | Reply-to address                               |

---

## Patterns

### 1. Graceful Degradation (No Key in Dev)

Never throw or crash when the API key is missing — fall back to logging:

```ts
if (!EMAILIT_API_KEY) {
  console.log(`[email:dev] To: ${to} | Subject: ${subject}`);
  return;
}
```

This lets development work without needing a real Emailit account.

---

### 2. Fire-and-Forget for Product Emails

For non-critical emails (session summaries, notifications), catch errors without re-throwing so a failed email never blocks the user-facing action:

```ts
try {
  await sendEmail({ to, subject, html, text });
} catch (error) {
  console.error("Failed to send email:", error);
  // do NOT re-throw — the user action should succeed regardless
}
```

---

### 3. Throw for Auth Emails

For auth-critical emails (verification, magic link, password reset), you may want to let the error propagate so the caller knows the email failed:

```ts
const response = await fetch("https://api.emailit.com/v2/emails", { ... });
if (!response.ok) {
  const error = await response.text();
  throw new Error(`Failed to send email: ${response.status} ${error}`);
}
```

---

### 4. Always Send Both HTML and Text

Every email should include both `html` and `text`. Many email clients, spam filters, and accessibility tools rely on the plain text version.

```ts
body: JSON.stringify({
  from: FROM_EMAIL,
  to,
  subject,
  html: buildHtml(data),   // full styled HTML
  text: buildText(data),   // plain text fallback
})
```

---

### 5. Log the Response ID

Emailit returns an `id` for each sent email. Always log it — it's your audit trail for debugging delivery issues:

```ts
const result = await response.json();
console.log(`Email sent to ${to}, Emailit ID: ${result.id}`);
```

---

## HTML Email Best Practices

Emailit delivers whatever HTML you send. To maximize compatibility (Gmail, Outlook, Apple Mail, mobile):

- **All styles must be inline** — no `<style>` blocks, no external CSS. Gmail strips `<style>` tags.
- **Use `<table>` for layout** — not CSS Grid or Flexbox. Outlook uses Word's rendering engine.
- **No JavaScript** — email clients strip it.
- **No SVG** — use `<img>` tags with hosted image URLs instead.
- **Always include `<meta charset="utf-8">`** and `<meta name="viewport">`.
- **Images must be hosted** — reference them by absolute URL (`https://...`).
- **Max width ~600px** — works well across desktop and mobile clients.
