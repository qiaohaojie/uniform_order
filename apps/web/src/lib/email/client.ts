// apps/web/src/lib/email/client.ts

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.EMAILIT_API_KEY;
  const from = process.env.FROM_EMAIL || "Uniform Online <noreply@uniformorder.online>";

  if (!apiKey) {
    console.log(`[email:dev] To: ${to} | Subject: ${subject}`);
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
