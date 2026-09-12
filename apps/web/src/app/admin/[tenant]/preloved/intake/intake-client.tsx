"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Description,
  Input,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import type { Tenant } from "@/lib/data";
import {
  PRELOVED_CONDITIONS,
  defaultPrelovedPrice,
  formatPrelovedCondition,
  isPrelovedPriceAboveCap,
  roundPrelovedPrice,
  type PrelovedCondition,
  type PrelovedIntakeMode,
} from "@/lib/preloved";
import { isConsignmentIntakeMode } from "@/lib/preloved-consignment";

export type IntakeCatalogItem = {
  id: string;
  name: string;
  category: string;
  variants: {
    id: string;
    label: string;
    price: number;
    sizes: string[];
  }[];
};

type IntakeSuccess = {
  kind: "accepted" | "rejected";
  message: string;
};

type IntakeLotOption = {
  id: string;
  ticketCode: string;
  familyName: string;
  studentName: string;
};

const DONATION_SOURCE = "donation";

function asKey(value: Key | Key[] | null): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function variantForSize(item: IntakeCatalogItem | undefined, size: string) {
  if (!item || !size) return undefined;
  return item.variants.find((variant) =>
    variant.sizes.some((entry) => String(entry) === size),
  );
}

function sizesForItem(item: IntakeCatalogItem | undefined): string[] {
  if (!item) return [];
  const seen = new Set<string>();
  const sizes: string[] = [];
  for (const variant of item.variants) {
    for (const size of variant.sizes) {
      const value = String(size);
      if (seen.has(value)) continue;
      seen.add(value);
      sizes.push(value);
    }
  }
  return sizes;
}

function matchesRefuseList(itemName: string, refuseList: string[]): boolean {
  const hay = itemName.toLowerCase();
  return refuseList.some((entry) => {
    const needle = entry.trim().toLowerCase();
    return needle.length > 0 && hay.includes(needle);
  });
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function IntakeClient({
  tenantId,
  tenant,
  catalog,
  priceFractionOfNew,
  refuseList,
  intakeMode,
}: {
  tenantId: string;
  tenant: Tenant;
  catalog: IntakeCatalogItem[];
  priceFractionOfNew: number;
  refuseList: string[];
  intakeMode: PrelovedIntakeMode;
}) {
  const [itemId, setItemId] = useState("");
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState<PrelovedCondition>("good");
  const [priceInput, setPriceInput] = useState("");
  const [defectNote, setDefectNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [pending, setPending] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<IntakeSuccess | null>(null);
  const [sourceKey, setSourceKey] = useState(DONATION_SOURCE);
  const [lots, setLots] = useState<IntakeLotOption[] | null>(null);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsError, setLotsError] = useState("");

  const consignmentDesk = isConsignmentIntakeMode(intakeMode);

  const loadLots = useCallback(async () => {
    if (!isConsignmentIntakeMode(intakeMode)) {
      setLots([]);
      setLotsError("");
      setLotsLoading(false);
      return;
    }
    setLotsLoading(true);
    setLotsError("");
    try {
      const res = await fetch(`/api/tenant/${tenantId}/preloved/consignment-lots`);
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        lots?: IntakeLotOption[];
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load consignment lots.");
      }
      setLots(
        Array.isArray(data?.lots)
          ? data.lots.map((lot) => ({
              id: lot.id,
              ticketCode: lot.ticketCode,
              familyName: lot.familyName,
              studentName: lot.studentName,
            }))
          : [],
      );
    } catch (err) {
      console.error("Intake lots load failed:", err);
      setLots(null);
      setLotsError(
        err instanceof Error ? err.message : "Failed to load consignment lots.",
      );
    } finally {
      setLotsLoading(false);
    }
  }, [intakeMode, tenantId]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  const selectedItem = catalog.find((item) => item.id === itemId);
  const sizeOptions = sizesForItem(selectedItem);
  const matchedVariant = variantForSize(selectedItem, size);
  const newVariantPrice = matchedVariant?.price ?? 0;
  const defaultPrice = matchedVariant
    ? defaultPrelovedPrice(newVariantPrice, priceFractionOfNew)
    : 0;

  const parsedPrice = Number(priceInput);
  const hasPrice = priceInput.trim().length > 0 && Number.isFinite(parsedPrice);
  const appliedPrice = hasPrice ? roundPrelovedPrice(parsedPrice) : defaultPrice;
  const priceAboveCap =
    matchedVariant != null &&
    hasPrice &&
    isPrelovedPriceAboveCap(parsedPrice, newVariantPrice, priceFractionOfNew);
  const onRefuseList = selectedItem
    ? matchesRefuseList(selectedItem.name, refuseList)
    : false;

  const itemById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );

  const handleItemChange = (value: Key | Key[] | null) => {
    const nextId = asKey(value);
    setItemId(nextId);
    setSize("");
    setPriceInput("");
    setSuccess(null);
    setError("");
  };

  const handleSizeChange = (value: Key | Key[] | null) => {
    const nextSize = asKey(value);
    setSize(nextSize);
    const item = itemById.get(itemId);
    const variant = variantForSize(item, nextSize);
    setPriceInput(
      variant
        ? defaultPrelovedPrice(variant.price, priceFractionOfNew).toFixed(2)
        : "",
    );
    setSuccess(null);
    setError("");
  };

  const postIntake = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/tenant/${tenantId}/preloved/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      sku?: { qtyOnHand?: number };
    } | null;
    if (!res.ok) {
      throw new Error(data?.error ?? "Failed to record intake.");
    }
    return data;
  };

  const handleAccept = async () => {
    if (!itemId || !size || !matchedVariant) {
      setError("Match an existing catalogue item and size before accepting.");
      return;
    }
    if (!hasPrice || parsedPrice <= 0 || parsedPrice > 10000) {
      setError("Enter a price greater than 0.");
      return;
    }

    setPending("accepted");
    setError("");
    setSuccess(null);
    try {
      const note = defectNote.trim();
      const selectedLot =
        sourceKey !== DONATION_SOURCE
          ? lots?.find((lot) => lot.id === sourceKey)
          : undefined;
      const data = await postIntake({
        action: "accepted",
        sourceItemId: itemId,
        size,
        condition,
        price: appliedPrice,
        ...(note.length > 0 ? { defectNote: note } : {}),
        ...(selectedLot ? { consignmentLotId: selectedLot.id } : {}),
      });
      const qty = data?.sku?.qtyOnHand;
      const qtyBit = typeof qty === "number" ? ` Qty on hand is now ${qty}.` : "";
      const sourceBit = selectedLot
        ? ` Linked to ${selectedLot.ticketCode}.`
        : " Donation pooled on the rack.";
      setSuccess({
        kind: "accepted",
        message: `Accepted ${selectedItem?.name ?? "item"} size ${size} (${formatPrelovedCondition(condition)}).${sourceBit}${qtyBit}`,
      });
      setDefectNote("");
    } catch (err) {
      console.error("Preloved accept failed:", err);
      setError(err instanceof Error ? err.message : "Failed to accept donation.");
    } finally {
      setPending(null);
    }
  };

  const handleReject = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      setError("A reject reason is required. Stock is unchanged.");
      return;
    }

    setPending("rejected");
    setError("");
    setSuccess(null);
    try {
      await postIntake({
        action: "rejected",
        sourceItemId: itemId || undefined,
        size: size || undefined,
        condition: itemId && size ? condition : undefined,
        rejectReason: reason,
      });
      setSuccess({
        kind: "rejected",
        message: "Rejected. No stock change and no parent listing.",
      });
      setRejectReason("");
    } catch (err) {
      console.error("Preloved reject failed:", err);
      setError(err instanceof Error ? err.message : "Failed to reject donation.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-7" data-testid="intake-desk">
      <p className="text-[13px] mb-4 max-w-2xl" style={{ color: "var(--color-ink-dim)" }}>
        Inspect a washed current-uniform garment. Match the new catalogue item
        and size, set Good or Fair, then accept onto the pooled rack.
        {consignmentDesk
          ? " Link a consignment ticket so sold units can be attributed to that lot."
          : " Source is donation only."}
      </p>

      {error ? (
        <div
          className="mb-3 text-[12.5px] px-3 py-2 rounded"
          style={{ background: "#FEF2F2", color: "#B91C1C" }}
          role="alert"
          data-testid="intake-error"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="mb-3 text-[12.5px] px-3 py-2 rounded"
          style={{ background: "#E5F0E7", color: "var(--color-success)" }}
          role="status"
          data-testid="intake-success"
        >
          {success.message}
        </div>
      ) : null}

      {catalog.length === 0 ? (
        <EmptyCatalogState />
      ) : (
        <div
          className="bg-white rounded-[10px] border p-6 max-w-3xl"
          style={{ borderColor: "var(--color-rule)", background: "var(--color-paper)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Select
              fullWidth
              name="sourceItemId"
              placeholder="Select a catalogue item"
              value={itemId || null}
              onChange={handleItemChange}
              data-testid="intake-item"
            >
              <Label>Catalogue item</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {catalog.map((item) => (
                    <ListBox.Item key={item.id} id={item.id} textValue={item.name}>
                      {item.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              <Description>Must match an existing new uniform item.</Description>
            </Select>

            <Select
              fullWidth
              name="size"
              placeholder={itemId ? "Select a size" : "Choose an item first"}
              value={size || null}
              onChange={handleSizeChange}
              isDisabled={!itemId}
              data-testid="intake-size"
            >
              <Label>Size</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {sizeOptions.map((option) => (
                    <ListBox.Item key={option} id={option} textValue={option}>
                      {option}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <RadioGroup
              name="condition"
              orientation="horizontal"
              value={condition}
              onChange={(value) => setCondition(value as PrelovedCondition)}
              data-testid="intake-condition"
            >
              <Label>Condition</Label>
              {PRELOVED_CONDITIONS.map((value) => (
                <Radio key={value} value={value}>
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    {formatPrelovedCondition(value)}
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>

            {consignmentDesk ? (
              <IntakeLotField
                sourceKey={sourceKey}
                lots={lots}
                loading={lotsLoading}
                error={lotsError}
                onChange={setSourceKey}
                onRetry={() => void loadLots()}
              />
            ) : (
              <TextField isReadOnly name="source" value="Donation">
                <Label>Source</Label>
                <Input />
                <Description>
                  Donation only. Turn on donation + consignment in Settings to
                  open the consign form and link tickets here.
                </Description>
              </TextField>
            )}

            <TextField
              name="price"
              type="number"
              value={priceInput}
              onChange={setPriceInput}
              isDisabled={!matchedVariant}
              data-testid="intake-price"
            >
              <Label>Price</Label>
              <Input
                className="tnum"
                inputMode="decimal"
                min={0.01}
                max={10000}
                step={0.01}
              />
              {matchedVariant ? (
                <Description>
                  Default {formatPercent(priceFractionOfNew)} of new (
                  {formatMoney(newVariantPrice)}), {formatMoney(defaultPrice)}.
                  You may type a lower price.
                </Description>
              ) : (
                <Description>Select an item and size to set the default price.</Description>
              )}
            </TextField>

            <TextField name="defectNote" value={defectNote} onChange={setDefectNote}>
              <Label>Defect note (optional)</Label>
              <TextArea
                rows={3}
                maxLength={500}
                placeholder="Faint mark on collar, missing button…"
              />
            </TextField>
          </div>

          {priceAboveCap ? (
            <p
              className="text-[12.5px] mt-3 font-semibold"
              style={{ color: "#92400E" }}
              data-testid="intake-price-warning"
              role="status"
            >
              This is above the shop cap of {formatPercent(priceFractionOfNew)} of
              new ({formatMoney(defaultPrice)}). You can still accept.
            </p>
          ) : null}

          {onRefuseList ? (
            <p className="text-[12.5px] mt-3" style={{ color: "var(--color-alert)" }}>
              This item is on the shop refuse list ({refuseList.join(", ")}).
              Reject unless you have a reason to accept.
            </p>
          ) : null}

          <TextField
            className="mt-5"
            name="rejectReason"
            value={rejectReason}
            onChange={setRejectReason}
            isInvalid={pending === null && error.toLowerCase().includes("reject reason")}
            data-testid="intake-reject-reason"
          >
            <Label>Reject reason</Label>
            <TextArea
              rows={2}
              maxLength={500}
              placeholder="Wrong style, stained, on the refuse list…"
            />
            <Description>Required to reject. Reject does not change stock.</Description>
          </TextField>

          <div className="flex flex-wrap items-center gap-3 pt-5">
            <Button
              isPending={pending === "accepted"}
              isDisabled={pending !== null}
              onPress={handleAccept}
              className="font-semibold text-white shadow-none"
              style={{ background: tenant.accent }}
              data-testid="intake-accept"
            >
              {pending === "accepted" ? "Accepting…" : "Accept"}
            </Button>
            <Button
              variant="danger"
              isPending={pending === "rejected"}
              isDisabled={pending !== null}
              onPress={handleReject}
              data-testid="intake-reject"
            >
              {pending === "rejected" ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function IntakeLotField({
  sourceKey,
  lots,
  loading,
  error,
  onChange,
  onRetry,
}: {
  sourceKey: string;
  lots: IntakeLotOption[] | null;
  loading: boolean;
  error: string;
  onChange: (value: string) => void;
  onRetry: () => void;
}) {
  const options = lots ?? [];

  return (
    <div className="md:col-span-2" data-testid="intake-lot-field">
      {loading ? (
        <div
          className="flex items-center gap-2 mb-2 text-[12.5px]"
          style={{ color: "var(--color-ink-dim)" }}
          data-testid="intake-lot-loading"
          role="status"
          aria-live="polite"
        >
          <Spinner size="sm" color="current" className="text-[var(--color-gold)]" />
          Loading consignment lots…
        </div>
      ) : null}

      {error ? (
        <div
          className="mb-2 text-[12.5px] px-3 py-2 rounded"
          style={{ background: "#FEF2F2", color: "#B91C1C" }}
          role="alert"
          data-testid="intake-lot-error"
        >
          <p>{error}</p>
          <button
            type="button"
            className="mt-1 underline font-semibold"
            onClick={onRetry}
            data-testid="intake-lot-retry"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error && options.length === 0 ? (
        <p
          className="mb-2 text-[12.5px]"
          style={{ color: "var(--color-ink-dim)" }}
          data-testid="intake-lot-empty"
        >
          No consignment lots yet. Parents submit the consign form first. You
          can still accept this garment as a donation.
        </p>
      ) : null}

      <Select
        fullWidth
        name="consignmentLotId"
        placeholder="Donation (pooled rack)"
        value={sourceKey}
        onChange={(value) => onChange(asKey(value) || DONATION_SOURCE)}
        data-testid="intake-lot"
      >
        <Label>Source lot</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item
              id={DONATION_SOURCE}
              textValue="Donation (pooled rack)"
            >
              Donation (pooled rack)
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {options.map((lot) => (
              <ListBox.Item
                key={lot.id}
                id={lot.id}
                textValue={`${lot.ticketCode} ${lot.familyName} ${lot.studentName}`}
              >
                {lot.ticketCode} — {lot.familyName} / {lot.studentName}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        <Description>
          Consigned garments still pool on the rack by item, size, and
          condition. The ticket is stored so a later payout CSV can attribute
          sold units.
        </Description>
      </Select>
    </div>
  );
}

function EmptyCatalogState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--color-parchment)", color: "var(--color-gold)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 9 H16" />
          <path d="M8 13 H14" />
        </svg>
      </div>
      <h2 className="font-serif text-[22px] font-medium leading-[1.2] mb-2" style={{ color: "var(--color-ink)" }}>
        No catalogue items to match
      </h2>
      <p className="text-[13.5px] leading-[1.5] max-w-md" style={{ color: "var(--color-ink-dim)" }}>
        Intake needs an active new catalogue item with sizes. Add one in Catalog,
        then return here to accept a washed donation.
      </p>
    </div>
  );
}
