"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Spinner } from "@heroui/react";

export type DonationInboxNote = {
  id: string;
  parentName: string;
  studentName: string;
  bagCount: number;
  createdAt: string;
};

const COLUMNS = ["Received", "Parent", "Student", "Bags"] as const;

function formatReceived(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function bagLabel(count: number) {
  return count === 1 ? "1 bag" : `${count} bags`;
}

export function DonationInboxClient({
  tenantId,
  timeZone,
}: {
  tenantId: string;
  timeZone: string;
}) {
  const [notes, setNotes] = useState<DonationInboxNote[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tenant/${tenantId}/preloved/donation-notes`);
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        notes?: DonationInboxNote[];
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load donation notes.");
      }
      setNotes(Array.isArray(data?.notes) ? data.notes : []);
    } catch (err) {
      console.error("Donation inbox load failed:", err);
      setNotes(null);
      setError(
        err instanceof Error ? err.message : "Failed to load donation notes.",
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  return (
    <div className="flex-1 overflow-y-auto p-7" data-testid="donation-inbox">
      <p
        className="text-[13px] mb-4 max-w-2xl"
        style={{ color: "var(--color-ink-dim)" }}
      >
        Drop-off notes from parents. These are messages to the shop, not
        listings. Washed bags still need intake at the desk.
      </p>

      {loading ? <InboxLoading /> : null}

      {!loading && error ? (
        <InboxError message={error} onRetry={() => void loadNotes()} />
      ) : null}

      {!loading && !error && notes && notes.length === 0 ? (
        <InboxEmpty />
      ) : null}

      {!loading && !error && notes && notes.length > 0 ? (
        <InboxList notes={notes} timeZone={timeZone} />
      ) : null}
    </div>
  );
}

function InboxLoading() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-6"
      data-testid="donation-inbox-loading"
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" color="current" className="mb-4 text-[var(--color-gold)]" />
      <p className="text-[13.5px]" style={{ color: "var(--color-ink-dim)" }}>
        Loading drop-off notes…
      </p>
    </div>
  );
}

function InboxError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="max-w-xl" data-testid="donation-inbox-error">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Could not load the inbox</Alert.Title>
          <Alert.Description>{message}</Alert.Description>
        </Alert.Content>
        <Button
          size="sm"
          variant="danger"
          onPress={onRetry}
          data-testid="donation-inbox-retry"
        >
          Try again
        </Button>
      </Alert>
    </div>
  );
}

function InboxEmpty() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-6"
      data-testid="donation-inbox-empty"
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--color-parchment)", color: "var(--color-gold)" }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 8 L12 13 L21 8" />
        </svg>
      </div>
      <h2
        className="font-serif text-[22px] font-medium leading-[1.2] mb-2"
        style={{ color: "var(--color-ink)" }}
      >
        No drop-off notes yet
      </h2>
      <p
        className="text-[13.5px] leading-[1.5] max-w-md"
        style={{ color: "var(--color-ink-dim)" }}
      >
        When a parent sends a bag note from Donate, it appears here. Notes do
        not create stock — accept washed garments on Intake.
      </p>
    </div>
  );
}

function InboxList({
  notes,
  timeZone,
}: {
  notes: DonationInboxNote[];
  timeZone: string;
}) {
  return (
    <div
      className="bg-white rounded-[10px] border overflow-hidden"
      style={{ borderColor: "var(--color-rule)" }}
      data-testid="donation-inbox-list"
    >
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr
            className="text-[10.5px] uppercase tracking-[0.6px]"
            style={{ color: "var(--color-ink-dim)" }}
          >
            {COLUMNS.map((label) => (
              <th
                key={label}
                className={`py-2.5 px-4 font-bold border-b ${
                  label === "Bags" ? "text-right" : "text-left"
                }`}
                style={{ borderColor: "var(--color-rule)" }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {notes.map((note, i) => (
            <tr
              key={note.id}
              className="border-b"
              style={{
                borderColor: i === notes.length - 1 ? "transparent" : "var(--color-rule)",
              }}
              data-testid="donation-inbox-row"
              data-note-id={note.id}
            >
              <td className="py-3 px-4 tnum" style={{ color: "var(--color-ink-dim)" }}>
                {formatReceived(note.createdAt, timeZone)}
              </td>
              <td className="py-3 px-4 font-medium" style={{ color: "var(--color-ink)" }}>
                {note.parentName}
              </td>
              <td className="py-3 px-4" style={{ color: "var(--color-ink)" }}>
                {note.studentName}
              </td>
              <td
                className="py-3 px-4 text-right tnum"
                style={{ color: "var(--color-ink)" }}
                data-testid="donation-inbox-bags"
              >
                {bagLabel(note.bagCount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
