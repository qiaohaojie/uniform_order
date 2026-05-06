import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;
  const key = process.env.POSTHOG_SERVER_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!key) return null;
  client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return client;
}

export async function serverCapture(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId, event, properties });
  await ph.flush();
}

export async function serverCaptureException(
  distinctId: string,
  error: Error,
  extra?: Record<string, unknown>
) {
  const ph = getClient();
  if (!ph) return;
  ph.captureException(error, distinctId, extra);
  await ph.flush();
}

export async function serverShutdown() {
  const ph = getClient();
  if (!ph) return;
  await ph.shutdown();
}
