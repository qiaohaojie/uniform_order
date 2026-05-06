import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export function initPosthog() {
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return;
  if (posthog.__loaded) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we capture manually in Next.js
    capture_pageleave: true,
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug(false);
    },
  });
}

export function capturePageview() {
  if (!posthog.__loaded) return;
  posthog.capture("$pageview");
}

export function captureException(error: Error, extra?: Record<string, unknown>) {
  if (!posthog.__loaded) return;
  posthog.captureException(error, extra);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!posthog.__loaded) return;
  posthog.identify(userId, traits);
}

export function resetUser() {
  if (!posthog.__loaded) return;
  posthog.reset();
}

export { posthog };
