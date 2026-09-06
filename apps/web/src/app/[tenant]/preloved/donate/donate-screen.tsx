"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import {
  MAX_DONATION_BAG_COUNT,
  MIN_DONATION_BAG_COUNT,
} from "@/lib/preloved-donate";

async function readApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: unknown };
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export function DonateScreen({
  tenantId,
  accent,
}: {
  tenantId: string;
  accent: string;
}) {
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [bagCount, setBagCount] = useState("1");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setError("");
    setSuccess(false);

    const parent = parentName.trim();
    const student = studentName.trim();
    const bags = Number.parseInt(bagCount, 10);
    if (!parent || !student) {
      setError("Enter parent name and student name.");
      return;
    }
    if (
      !Number.isInteger(bags) ||
      bags < MIN_DONATION_BAG_COUNT ||
      bags > MAX_DONATION_BAG_COUNT
    ) {
      setError(
        `Bag count must be a whole number between ${MIN_DONATION_BAG_COUNT} and ${MAX_DONATION_BAG_COUNT}.`,
      );
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/preloved/donate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: parent,
          studentName: student,
          bagCount: bags,
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res, "Could not send the drop-off note."));
        return;
      }
      setSuccess(true);
      setParentName("");
      setStudentName("");
      setBagCount("1");
    } catch (err) {
      console.error("Donate note failed:", err);
      setError("Could not send the drop-off note.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {error ? (
        <div
          className="mb-3 text-[12.5px] px-3 py-2 rounded"
          style={{ background: "#FEF2F2", color: "#B91C1C" }}
          role="alert"
          data-testid="donate-note-error"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="mb-3 text-[12.5px] px-3 py-2 rounded"
          style={{ background: "#E5F0E7", color: "var(--color-success)" }}
          role="status"
          data-testid="donate-note-success"
        >
          The shop has your drop-off note. This is not a listing — leave the
          washed bag at the shop.
        </div>
      ) : null}

      <Form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
        aria-label="Drop-off note"
      >
        <TextField
          fullWidth
          isRequired
          name="parentName"
          value={parentName}
          onChange={setParentName}
          maxLength={80}
          data-testid="donate-note-parent"
        >
          <Label>Parent name</Label>
          <Input autoComplete="name" placeholder="Your name" />
          <FieldError />
        </TextField>

        <TextField
          fullWidth
          isRequired
          name="studentName"
          value={studentName}
          onChange={setStudentName}
          maxLength={80}
          data-testid="donate-note-student"
        >
          <Label>Student name</Label>
          <Input autoComplete="off" placeholder="Student name" />
          <FieldError />
        </TextField>

        <TextField
          fullWidth
          isRequired
          name="bagCount"
          type="number"
          value={bagCount}
          onChange={setBagCount}
          data-testid="donate-note-bags"
        >
          <Label>Bag count</Label>
          <Input
            className="tnum"
            inputMode="numeric"
            min={MIN_DONATION_BAG_COUNT}
            max={MAX_DONATION_BAG_COUNT}
            step={1}
          />
          <Description>
            How many bags you are dropping off ({MIN_DONATION_BAG_COUNT}–
            {MAX_DONATION_BAG_COUNT}).
          </Description>
          <FieldError />
        </TextField>

        <Button
          type="submit"
          isPending={pending}
          isDisabled={pending}
          className="font-semibold text-white shadow-none self-start"
          style={{ background: accent }}
          data-testid="donate-note-submit"
        >
          {pending ? "Sending…" : "Send drop-off note"}
        </Button>
      </Form>
    </>
  );
}
