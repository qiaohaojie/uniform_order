"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_PRICE_FRACTION_OF_NEW,
  isPersistablePriceFractionOfNew,
  PRELOVED_INTAKE_MODES,
  roundPriceFractionOfNew,
  type PrelovedIntakeMode,
  type PrelovedSettings,
} from "@/lib/preloved";
import {
  COMMISSION_BPS_PRESETS,
  DEFAULT_COMMISSION_BPS,
  formatCommissionPercent,
  isConsignmentIntakeMode,
  isValidCommissionBps,
} from "@/lib/preloved-consignment";

const GST_FREE_COPY =
  "Confirm with your accountant that your P&C / school is an endorsed charity, gift-deductible entity, or government school before treating donated preloved as GST-free (GST Act s 38-255).";

function formatRefuseList(list: string[]) {
  return list.join(", ");
}

function parseRefuseListInput(value: string): string[] {
  return value
    .split(/[,|\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function PrelovedSettingsSection({
  tenantId,
  accent,
  settings,
}: {
  tenantId: string;
  accent: string;
  settings: PrelovedSettings;
}) {
  const [enabled, setEnabled] = useState(settings.prelovedEnabled);
  const [intakeMode, setIntakeMode] = useState<PrelovedIntakeMode>(settings.intakeMode);
  const [commissionBps, setCommissionBps] = useState(String(settings.commissionBps));
  const [priceFraction, setPriceFraction] = useState(String(settings.priceFractionOfNew));
  const [holdDays, setHoldDays] = useState(String(settings.holdDays));
  const [refuseList, setRefuseList] = useState(formatRefuseList(settings.refuseList));
  const [donatedGstFree, setDonatedGstFree] = useState(settings.donatedGstFree);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const router = useRouter();

  const parsedFraction = Number(priceFraction);
  const showFractionWarning =
    Number.isFinite(parsedFraction) && parsedFraction > DEFAULT_PRICE_FRACTION_OF_NEW;
  const consignOn = isConsignmentIntakeMode(intakeMode);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");

    const parsedFractionValue = Number(priceFraction);
    const days = Number(holdDays);
    const commission = Number(commissionBps);
    if (!isPersistablePriceFractionOfNew(parsedFractionValue)) {
      setSaveError("Price fraction must be at least 0.01 and at most 2.");
      setSaving(false);
      return;
    }
    const fraction = roundPriceFractionOfNew(parsedFractionValue);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setSaveError("Hold days must be a whole number between 1 and 3650.");
      setSaving(false);
      return;
    }
    if (!isValidCommissionBps(commission)) {
      setSaveError("Commission must be an integer between 0 and 10000 basis points.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/tenant/${tenantId}/preloved`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prelovedEnabled: enabled,
          intakeMode,
          commissionBps: commission,
          priceFractionOfNew: fraction,
          holdDays: days,
          donatedGstFree,
          refuseList: parseRefuseListInput(refuseList),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save preloved settings.");
      }
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save preloved settings:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to save preloved settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border p-6" style={{ borderColor: "var(--color-rule)" }}>
      <h2 className="type-h2 mb-1" style={{ color: "var(--color-ink)" }}>
        Preloved
      </h2>
      <p className="text-[12.5px] mb-4" style={{ color: "var(--color-ink-dim)" }}>
        Donation rack by default. Enable donation + consignment to open the parent
        consign form, lot tickets, and school-fee credit marks.
      </p>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
              Enable preloved
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--color-ink-dim)" }}>
              When off, the preloved rack stays hidden from parents.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Enable preloved"
            data-testid="preloved-enabled-switch"
            onClick={() => setEnabled((on) => !on)}
            className="w-10 h-6 rounded-full relative flex-shrink-0 transition-colors"
            style={{ background: enabled ? accent : "var(--color-rule)" }}
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all pointer-events-none"
              style={{ left: enabled ? "calc(100% - 20px)" : 4 }}
            />
          </button>
        </div>

        <fieldset data-testid="preloved-intake-mode">
          <legend
            className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Intake mode
          </legend>
          <div className="flex flex-col gap-2">
            {PRELOVED_INTAKE_MODES.map((mode) => (
              <label
                key={mode}
                className="flex items-start gap-2 text-[12.5px]"
                style={{ color: "var(--color-ink)" }}
              >
                <input
                  type="radio"
                  name="intakeMode"
                  value={mode}
                  checked={intakeMode === mode}
                  onChange={() => setIntakeMode(mode)}
                  data-testid={`preloved-intake-mode-${mode}`}
                  className="mt-0.5"
                />
                <span>
                  {mode === "donation_only"
                    ? "Donation only"
                    : "Donation + consignment"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {consignOn ? (
          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5"
              style={{ color: "var(--color-ink-dim)" }}
              htmlFor="preloved-commission-bps"
            >
              Shop commission (basis points)
            </label>
            <input
              id="preloved-commission-bps"
              type="number"
              inputMode="numeric"
              min={0}
              max={10000}
              step={100}
              value={commissionBps}
              onChange={(e) => setCommissionBps(e.target.value)}
              className="w-full h-10 border rounded-md px-3 text-[13px] outline-none tnum"
              style={{
                borderColor: "var(--color-rule)",
                color: "var(--color-ink)",
                fontFamily: "var(--font-sans)",
              }}
              data-testid="preloved-commission-bps"
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
              Default {DEFAULT_COMMISSION_BPS} ({formatCommissionPercent(DEFAULT_COMMISSION_BPS)}
              to the shop). Common presets:{" "}
              {COMMISSION_BPS_PRESETS.map((bps) => formatCommissionPercent(bps)).join(", ")}.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5"
              style={{ color: "var(--color-ink-dim)" }}
              htmlFor="preloved-price-fraction"
            >
              Price fraction of new
            </label>
            <input
              id="preloved-price-fraction"
              type="number"
              inputMode="decimal"
              min={0.01}
              max={2}
              step={0.01}
              value={priceFraction}
              onChange={(e) => setPriceFraction(e.target.value)}
              className="w-full h-10 border rounded-md px-3 text-[13px] outline-none tnum"
              style={{
                borderColor: "var(--color-rule)",
                color: "var(--color-ink)",
                fontFamily: "var(--font-sans)",
              }}
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
              Default 0.50 (50% of the matching new price).
            </p>
            {showFractionWarning && (
              <p className="text-[11.5px] mt-1 font-semibold" style={{ color: "#92400E" }}>
                Typically 50% of new or less. You can still save this value.
              </p>
            )}
          </div>
          <div>
            <label
              className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5"
              style={{ color: "var(--color-ink-dim)" }}
              htmlFor="preloved-hold-days"
            >
              Hold days
            </label>
            <input
              id="preloved-hold-days"
              type="number"
              inputMode="numeric"
              min={1}
              max={3650}
              step={1}
              value={holdDays}
              onChange={(e) => setHoldDays(e.target.value)}
              className="w-full h-10 border rounded-md px-3 text-[13px] outline-none tnum"
              style={{
                borderColor: "var(--color-rule)",
                color: "var(--color-ink)",
                fontFamily: "var(--font-sans)",
              }}
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
              Unsold donations can be written off after this many days (default 365).
            </p>
          </div>
        </div>

        <div>
          <label
            className="block text-[11px] font-bold uppercase tracking-[0.6px] mb-1.5"
            style={{ color: "var(--color-ink-dim)" }}
            htmlFor="preloved-refuse-list"
          >
            Refuse list
          </label>
          <textarea
            id="preloved-refuse-list"
            value={refuseList}
            onChange={(e) => setRefuseList(e.target.value)}
            rows={2}
            placeholder="socks, swimwear, hats"
            className="w-full border rounded-md px-3 py-2 text-[13px] outline-none resize-y"
            style={{
              borderColor: "var(--color-rule)",
              color: "var(--color-ink)",
              fontFamily: "var(--font-sans)",
            }}
          />
          <p className="text-[11px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
            Comma-separated items the shop will not accept.
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-[12.5px]" style={{ color: "var(--color-ink)" }}>
          <input
            type="checkbox"
            checked={donatedGstFree}
            onChange={(e) => setDonatedGstFree(e.target.checked)}
            className="mt-0.5"
            aria-describedby="preloved-gst-copy"
          />
          <span>
            <span className="font-semibold block mb-0.5">Treat donated preloved as GST-free</span>
            <span id="preloved-gst-copy" style={{ color: "var(--color-ink-dim)" }}>
              {GST_FREE_COPY} Consignment sales stay taxable by default.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-60"
            style={{ background: accent }}
          >
            {saving ? "Saving…" : "Save preloved settings"}
          </button>
          {saved && (
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--color-success)" }}>
              ✓ Saved
            </span>
          )}
          {saveError && (
            <span className="text-[12.5px] font-semibold" style={{ color: "#B23A2A" }}>
              {saveError}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
