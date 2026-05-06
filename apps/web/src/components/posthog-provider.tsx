"use client";

import { useEffect } from "react";
import { initPosthog, capturePageview } from "@/lib/analytics/client";

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthog();
    capturePageview();
  }, []);

  return <>{children}</>;
}
