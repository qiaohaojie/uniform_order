"use client";

import { useEffect } from "react";
import { Alert, Button } from "@heroui/react";
import { captureException } from "@/lib/analytics/client";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Platform console error:", error);
    captureException(error, { digest: error.digest, page: window.location.pathname });
  }, [error]);

  return (
    <div className="flex-1 overflow-y-auto p-7" data-testid="platform-error" role="alert">
      <div className="max-w-lg">
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Platform console could not load</Alert.Title>
            <Alert.Description>
              Tenant data could not be loaded. Check the database connection and try again.
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="danger" onPress={reset} data-testid="platform-error-retry">
            Try again
          </Button>
        </Alert>
      </div>
    </div>
  );
}
