// apps/web/src/lib/email/client.ts

// Conservative RFC-5322-ish single-address check. We only need to reject
// obviously malformed / injection-shaped recipients before handing the value
// to the provider — not to fully parse every legal address form.
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// Mask an address for log output so recipient PII never lands in stdout:
// "jane.doe@example.com" -> "j***@example.com".
function maskEmail(addr: string): string {
  const at = addr.indexOf("@");
  if (at <= 0) return "***";
  return `${addr[0]}***${addr.slice(at)}`;
}

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.EMAILIT_API_KEY;
  const from = process.env.FROM_EMAIL || "Uniform Online <noreply@uniformorder.online>";

  if (!EMAIL_RE.test(to)) {
    console.error(`Refusing to send email to malformed recipient: ${maskEmail(to)}`);
    return null;
  }

  if (!apiKey) {
    console.log(`[email:dev] To: ${maskEmail(to)} | Subject: ${subject}`);
    return { id: "dev-mode-id" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for serverless

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
        console.error(`Emailit 4xx Error (${res.status}): ${error}`);
        return null; // Do not retry
      }
      throw new Error(`Emailit 5xx Error (${res.status}): ${error}`);
    }

    return await res.json(); // { id: string }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Emailit delivery error:", err);
    throw err; // Re-throw 5xx or timeout for high-priority logging
  }
}
