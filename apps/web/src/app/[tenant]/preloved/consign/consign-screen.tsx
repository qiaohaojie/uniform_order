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
  formatCommissionPercent,
  type ConsignmentPayoutPreference,
  type ConsignmentUnsoldPreference,
} from "@/lib/preloved-consignment";

async function readApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: unknown };
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

type ItemRow = { garment: string; size: string };

export function ConsignScreen({
  tenantId,
  accent,
  commissionBps,
}: {
  tenantId: string;
  accent: string;
  commissionBps: number;
}) {
  const [familyName, setFamilyName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [payoutPreference, setPayoutPreference] =
    useState<ConsignmentPayoutPreference>("school_fee_credit");
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [unsoldPreference, setUnsoldPreference] =
    useState<ConsignmentUnsoldPreference>("donate");
  const [items, setItems] = useState<ItemRow[]>([{ garment: "", size: "" }]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ticketCode, setTicketCode] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError("");
    setTicketCode("");

    if (!termsAccepted) {
      setError("You must agree to the shop consignment terms.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/preloved/consign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyName: familyName.trim(),
          studentName: studentName.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          payoutPreference,
          bankBsb: payoutPreference === "eft" ? bankBsb.trim() : null,
          bankAccountName:
            payoutPreference === "eft" ? bankAccountName.trim() : null,
          bankAccountNumber:
            payoutPreference === "eft" ? bankAccountNumber.trim() : null,
          unsoldPreference,
          items: items.map((item) => ({
            garment: item.garment.trim(),
            size: item.size.trim(),
          })),
          termsAccepted: true,
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res, "Could not submit the consignment form."));
        return;
      }
      const data = (await res.json()) as { ticketCode?: string };
      setTicketCode(data.ticketCode ?? "");
      setFamilyName("");
      setStudentName("");
      setEmail("");
      setMobile("");
      setBankBsb("");
      setBankAccountName("");
      setBankAccountNumber("");
      setItems([{ garment: "", size: "" }]);
      setTermsAccepted(false);
      setPayoutPreference("school_fee_credit");
      setUnsoldPreference("donate");
    } catch (err) {
      console.error("Consign form failed:", err);
      setError("Could not submit the consignment form.");
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
          data-testid="consign-form-error"
        >
          {error}
        </div>
      ) : null}
      {ticketCode ? (
        <div
          className="mb-3 text-[12.5px] px-3 py-2 rounded"
          style={{ background: "#E5F0E7", color: "var(--color-success)" }}
          role="status"
          data-testid="consign-form-success"
        >
          Consignment lot received. Write ticket{" "}
          <span className="font-semibold tnum" data-testid="consign-ticket-code">
            {ticketCode}
          </span>{" "}
          on the bag tag and drop the washed bag at the shop. This is not a
          listing — volunteers still inspect each garment.
        </div>
      ) : null}

      <p className="text-sm text-ink-dim mb-4">
        Shop commission is {formatCommissionPercent(commissionBps)} of the sale
        price. Proceeds are paid by the school (EFT, school-fee credit, or
        donated) — not through Stripe to parents.
      </p>

      <Form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
        aria-label="Consignment form"
        data-testid="consign-form"
      >
        <TextField
          fullWidth
          isRequired
          name="familyName"
          value={familyName}
          onChange={setFamilyName}
          maxLength={80}
          data-testid="consign-family"
        >
          <Label>Family name</Label>
          <Input autoComplete="family-name" />
          <FieldError />
        </TextField>

        <TextField
          fullWidth
          isRequired
          name="studentName"
          value={studentName}
          onChange={setStudentName}
          maxLength={80}
          data-testid="consign-student"
        >
          <Label>Student name</Label>
          <Input autoComplete="off" />
          <FieldError />
        </TextField>

        <TextField
          fullWidth
          isRequired
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          maxLength={120}
          data-testid="consign-email"
        >
          <Label>Email</Label>
          <Input autoComplete="email" />
          <FieldError />
        </TextField>

        <TextField
          fullWidth
          isRequired
          name="mobile"
          value={mobile}
          onChange={setMobile}
          maxLength={40}
          data-testid="consign-mobile"
        >
          <Label>Mobile</Label>
          <Input autoComplete="tel" />
          <FieldError />
        </TextField>

        <fieldset className="space-y-2" data-testid="consign-payout-preference">
          <legend className="text-[13px] font-semibold text-ink mb-1">
            Payout preference
          </legend>
          {(
            [
              ["school_fee_credit", "Credit school fees"],
              ["eft", "EFT to bank account"],
              ["donate_proceeds", "Donate proceeds to the P&C"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="payoutPreference"
                value={value}
                checked={payoutPreference === value}
                onChange={() => setPayoutPreference(value)}
                data-testid={`consign-payout-${value}`}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {payoutPreference === "eft" ? (
          <div className="space-y-3 rounded-lg border border-rule p-3">
            <TextField
              fullWidth
              isRequired
              name="bankBsb"
              value={bankBsb}
              onChange={setBankBsb}
              data-testid="consign-bank-bsb"
            >
              <Label>BSB</Label>
              <Input className="tnum" inputMode="numeric" placeholder="000000" />
              <Description>Operator-only. Not shown in the parent shop.</Description>
              <FieldError />
            </TextField>
            <TextField
              fullWidth
              isRequired
              name="bankAccountName"
              value={bankAccountName}
              onChange={setBankAccountName}
              data-testid="consign-bank-name"
            >
              <Label>Account name</Label>
              <Input />
              <FieldError />
            </TextField>
            <TextField
              fullWidth
              isRequired
              name="bankAccountNumber"
              value={bankAccountNumber}
              onChange={setBankAccountNumber}
              data-testid="consign-bank-number"
            >
              <Label>Account number</Label>
              <Input className="tnum" inputMode="numeric" />
              <FieldError />
            </TextField>
          </div>
        ) : null}

        <fieldset className="space-y-2" data-testid="consign-unsold-preference">
          <legend className="text-[13px] font-semibold text-ink mb-1">
            If unsold at expiry
          </legend>
          {(
            [
              ["donate", "Donate to charity"],
              ["collect", "Collect within 14 days, then donate"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="unsoldPreference"
                value={value}
                checked={unsoldPreference === value}
                onChange={() => setUnsoldPreference(value)}
                data-testid={`consign-unsold-${value}`}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="space-y-3" data-testid="consign-items">
          <div className="text-[13px] font-semibold text-ink">Items in the bag</div>
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_5.5rem] gap-2">
              <TextField
                fullWidth
                isRequired
                name={`garment-${index}`}
                value={item.garment}
                onChange={(value) =>
                  setItems((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, garment: value } : row,
                    ),
                  )
                }
                data-testid={`consign-item-garment-${index}`}
              >
                <Label>Garment</Label>
                <Input placeholder="Sports polo" />
                <FieldError />
              </TextField>
              <TextField
                fullWidth
                isRequired
                name={`size-${index}`}
                value={item.size}
                onChange={(value) =>
                  setItems((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, size: value } : row,
                    ),
                  )
                }
                data-testid={`consign-item-size-${index}`}
              >
                <Label>Size</Label>
                <Input placeholder="10" />
                <FieldError />
              </TextField>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onPress={() =>
              setItems((prev) =>
                prev.length >= 30 ? prev : [...prev, { garment: "", size: "" }],
              )
            }
            data-testid="consign-add-item"
          >
            Add another item
          </Button>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5"
            data-testid="consign-terms"
          />
          <span>
            I agree the shop sets the sale price, keeps the published commission,
            and remits the balance by my payout preference. Unsold items follow
            my unsold choice. Sold as worn — ACL still applies.
          </span>
        </label>

        <Button
          type="submit"
          isPending={pending}
          isDisabled={pending}
          className="font-semibold text-white shadow-none self-start"
          style={{ background: accent }}
          data-testid="consign-submit"
        >
          {pending ? "Submitting…" : "Submit consignment form"}
        </Button>
      </Form>
    </>
  );
}
