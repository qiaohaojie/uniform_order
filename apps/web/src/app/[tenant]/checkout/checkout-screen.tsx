"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { loadStripe, type Stripe, type StripePaymentElement, type StripeElements } from "@stripe/stripe-js";
import type { Tenant } from "@/lib/data";
import { cartTotal } from "@/lib/data";
import { useCart } from "@/lib/cart-store";
import { Btn } from "@/components/btn";
import { BackIcon, CheckIcon, LockIcon, PickupIcon, ShipIcon } from "@/components/icons";
import { readStudentDetails, writeStudentDetails, type StudentDetails } from "@/lib/order-store";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";
import { posthog } from "@/lib/analytics/client";
import { SHIP_FEE_AUD } from "@/lib/shipping";

type Prefill = { studentName: string; year: string; rollClass: string } | null;

type Delivery = "pickup" | "ship";

const YEAR_OPTIONS = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"];
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

async function readApiError(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export function CheckoutScreen({
  tenant,
  prefill,
  shippingEnabled,
  pickupEnabled,
}: {
  tenant: Tenant;
  prefill: Prefill;
  shippingEnabled: boolean;
  pickupEnabled: boolean;
}) {
  const router = useRouter();
  const { lines, clearCart } = useCart();
  const [delivery, setDelivery] = useState<Delivery>(
    shippingEnabled && !pickupEnabled ? "ship" : "pickup",
  );

  // If shipping gets disabled while ship is selected, fall back to pickup.
  useEffect(() => {
    if (!shippingEnabled && delivery === "ship") setDelivery("pickup");
  }, [shippingEnabled, delivery]);
  const [paying, setPaying] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentLocked, setPaymentLocked] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [student, setStudent] = useState<StudentDetails>(() => {
    const saved = readStudentDetails();
    return {
      studentName: prefill?.studentName ?? saved?.studentName ?? "",
      rollClass: prefill?.rollClass ?? saved?.rollClass ?? "",
      year: prefill?.year ?? saved?.year ?? "Year 9",
      parentName: saved?.parentName ?? "",
      mobile: saved?.mobile ?? "",
      email: saved?.email ?? "",
    };
  });
  const [parentNote, setParentNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof StudentDetails, string>>>({});
  const paymentMountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const paymentLockedRef = useRef(false);

  const subtotal = cartTotal(lines);
  const ship = delivery === "ship" ? SHIP_FEE_AUD : 0;
  const total = subtotal + ship;
  const gst = total / 11;

  // When active-child prefill is in effect, write the merged values to localStorage
  // on first render so a parent who switches active child and bounces away mid-checkout
  // sees the correct prefill on return.
  useEffect(() => {
    if (prefill) {
      writeStudentDetails(student);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    paymentLockedRef.current = paymentLocked;
  }, [paymentLocked]);

  useEffect(() => {
    let cancelled = false;
    if (!stripePromise) return;

    stripePromise.then((stripe) => {
      if (cancelled) return;
      if (!stripe) {
        setPaymentReady(false);
        setPaymentError(
          "Payment form could not load. Please refresh the page or contact the shop.",
        );
        return;
      }
      if (!paymentMountRef.current) return;

      const elements = stripe.elements({
        mode: "payment",
        amount: Math.round(total * 100),
        currency: "aud",
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: tenant.accent,
            fontFamily: "Inter, system-ui, sans-serif",
          },
        },
      });
      const paymentElement = elements.create("payment", { layout: "tabs" });

      paymentElement.on("ready", () => {
        if (paymentLockedRef.current) return;
        setPaymentReady(true);
        setPaymentError("");
      });
      paymentElement.on("change", (_e) => {
        if (paymentLockedRef.current) return;
        setPaymentError("");
      });
      paymentElement.mount(paymentMountRef.current);

      stripeRef.current = stripe;
      elementsRef.current = elements;
      paymentElementRef.current = paymentElement;
    }).catch(() => {
      if (cancelled) return;
      setPaymentReady(false);
      setPaymentError(
        "Payment form could not load. Please refresh the page or contact the shop.",
      );
    });

    return () => {
      cancelled = true;
      paymentElementRef.current?.destroy();
      paymentElementRef.current = null;
      elementsRef.current = null;
      stripeRef.current = null;
      setPaymentReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once on initial stripe load
  }, []);

  useEffect(() => {
    if (!elementsRef.current) return;
    elementsRef.current.update({ amount: Math.round(total * 100) });
  }, [total]);

  const setField = (field: keyof StudentDetails, value: string) => {
    setStudent((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const errs: Partial<Record<keyof StudentDetails, string>> = {};
    if (!student.studentName.trim()) errs.studentName = "Required";
    if (!student.rollClass.trim()) errs.rollClass = "Required";
    if (!student.parentName.trim()) errs.parentName = "Required";
    if (!student.mobile.trim()) errs.mobile = "Required";
    if (!student.email.trim()) errs.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) errs.email = "Invalid email";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onPay = async () => {
    if (paymentLocked) return;
    setPaymentError("");
    if (!validate()) return;
    if (lines.length === 0) {
      setPaymentError("Your cart is empty.");
      return;
    }
    if (!stripePublishableKey || !stripePromise) {
      setPaymentError("Payment is unavailable because Stripe is not configured.");
      return;
    }
    if (!stripeRef.current || !elementsRef.current || !paymentReady) {
      setPaymentError("Payment form is still loading. Please try again in a moment.");
      return;
    }
    if (!acceptedPolicy) {
      setPaymentError("Please accept the terms and privacy policy before paying.");
      return;
    }

    writeStudentDetails(student);
    posthog.capture("payment_attempted", {
      tenant_id: tenant.id,
      delivery,
      total,
      item_count: lines.length,
    });
    setPaying(true);
    let confirmedPaymentIntentId: string | null = null;
    try {
      const paymentIntentRes = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          amount: total,
          currency: "aud",
          // `size` is included so the server-side per-line snapshot written at
          // PI creation carries the full line (it is not price-bearing).
          lines: lines.map((l) => ({
            itemId: l.itemId,
            variantLabel: l.variantLabel,
            size: l.size,
            unitPrice: l.price,
            qty: l.qty,
          })),
          delivery,
          subtotal,
          gst,
          metadata: {
            parentEmail: student.email,
            studentName: student.studentName,
            studentYear: student.year,
            delivery,
          },
        }),
      });

      if (!paymentIntentRes.ok) {
        setPaymentError(await readApiError(paymentIntentRes, "Failed to start payment. Please try again."));
        setPaying(false);
        return;
      }

      const { clientSecret } = await paymentIntentRes.json();
      if (typeof clientSecret !== "string" || !clientSecret) {
        setPaymentError("Payment could not be started. Please contact the shop.");
        setPaying(false);
        return;
      }

      // Deferred-intent flow: submit first, then confirm with the PI's clientSecret.
      const { error: submitError } = await elementsRef.current!.submit();
      if (submitError) {
        setPaymentError(submitError.message ?? "Payment validation failed");
        setPaying(false);
        return;
      }

      const { error, paymentIntent } = await stripeRef.current!.confirmPayment({
        elements: elementsRef.current!,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/${tenant.id}/order/placed`,
          payment_method_data: {
            billing_details: {
              name: student.parentName,
              email: student.email,
              phone: student.mobile,
            },
          },
        },
        redirect: "if_required",
      });

      if (error) {
        posthog.capture("payment_failed", {
          tenant_id: tenant.id,
          error_code: error.code,
          error_type: error.type,
          delivery,
          total,
        });
        setPaymentError(error.message ?? "Payment failed. Please check your card details and try again.");
        setPaying(false);
        return;
      }

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        posthog.capture("payment_failed", {
          tenant_id: tenant.id,
          reason: "intent_not_succeeded",
          status: paymentIntent?.status,
          delivery,
          total,
        });
        setPaymentError("Payment was not completed. Please check your card details and try again.");
        setPaying(false);
        return;
      }
      confirmedPaymentIntentId = paymentIntent.id;

      const orderPayload = {
        tenantId: tenant.id,
        parentName: student.parentName,
        parentEmail: student.email,
        parentMobile: student.mobile,
        studentName: student.studentName,
        studentYear: student.year,
        studentRoll: student.rollClass,
        fulfilmentMethod: delivery === "ship" ? "shipping" : "pickup",
        deliveryFee: delivery === "ship" ? SHIP_FEE_AUD : 0,
        subtotal,
        gst,
        total,
        stripePaymentIntentId: paymentIntent.id,
        refundPolicyAccepted: acceptedPolicy,
        parentNote: parentNote.trim() ? parentNote.trim() : null,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.name,
          variantLabel: l.variantLabel,
          size: l.size,
          qty: l.qty,
          unitPrice: l.price,
          lineTotal: l.price * l.qty,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      if (res.ok) {
        const { orderId } = await res.json();
        clearCart();
        const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
        const matchesActive =
          prefill !== null &&
          norm(student.studentName) === norm(prefill.studentName) &&
          norm(student.year) === norm(prefill.year) &&
          norm(student.rollClass) === norm(prefill.rollClass);
        if (!matchesActive) {
          clearActiveChildCookieClient();
        }
        router.push(`/${tenant.id}/order/placed?total=${total.toFixed(2)}&delivery=${delivery}&orderId=${orderId}`);
      } else {
        const message = await readApiError(res, "Failed to place order.");
        paymentLockedRef.current = true;
        setPaymentLocked(true);
        setPaymentError(`${message} Your payment was confirmed. Do not retry payment. Contact the shop with Stripe reference ${paymentIntent.id}.`);
        setPaying(false);
      }
    } catch (err) {
      console.error("Order submission error:", err);
      if (confirmedPaymentIntentId) {
        paymentLockedRef.current = true;
        setPaymentLocked(true);
        setPaymentError(`Network error while placing the order. Your payment was confirmed. Do not retry payment. Contact the shop with Stripe reference ${confirmedPaymentIntentId}.`);
      } else {
        setPaymentError("Network error. Please try again.");
      }
      setPaying(false);
    }
  };

  return (
    <>
      <div className="px-4 pt-1.5 pb-3 flex items-center gap-2.5 flex-shrink-0">
        <Link
          href={`/${tenant.id}/cart`}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "var(--color-parchment)" }}
          aria-label="Back"
        >
          <BackIcon size={18} />
        </Link>
        <div
          className="flex-1 text-center font-serif text-[17px] font-semibold"
          style={{ color: tenant.accent }}
        >
          Checkout
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] pt-1 pb-4">
        {/* Student details */}
        <SectionLabel>Student details</SectionLabel>
        <div className="rounded-[10px] border bg-white p-3.5 mb-4" style={{ borderColor: "var(--color-rule)" }}>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <div className="col-span-2">
              <FieldLabel htmlFor="studentName">Student name</FieldLabel>
              <input id="studentName" value={student.studentName} onChange={(e) => setField("studentName", e.target.value)}
                placeholder="e.g. Tim Taylor"
                aria-required="true" aria-invalid={!!fieldErrors.studentName}
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.studentName ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.studentName && <FieldError>{fieldErrors.studentName}</FieldError>}
            </div>
            <div>
              <FieldLabel htmlFor="year">Year</FieldLabel>
              <select id="year" value={student.year} onChange={(e) => setField("year", e.target.value)}
                aria-required="true"
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none bg-white"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="rollClass">Roll class</FieldLabel>
              <input id="rollClass" value={student.rollClass} onChange={(e) => setField("rollClass", e.target.value)}
                placeholder="e.g. 9F"
                aria-required="true" aria-invalid={!!fieldErrors.rollClass}
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.rollClass ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.rollClass && <FieldError>{fieldErrors.rollClass}</FieldError>}
            </div>
          </div>
          <div className="h-px mb-3" style={{ background: "var(--color-rule)" }} />
          <div className="flex flex-col gap-2.5">
            <div>
              <FieldLabel htmlFor="parentName">Parent / guardian name</FieldLabel>
              <input id="parentName" value={student.parentName} onChange={(e) => setField("parentName", e.target.value)}
                placeholder="e.g. Alex Taylor"
                aria-required="true" aria-invalid={!!fieldErrors.parentName}
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.parentName ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.parentName && <FieldError>{fieldErrors.parentName}</FieldError>}
            </div>
            <div>
              <FieldLabel htmlFor="mobile">Mobile</FieldLabel>
              <input id="mobile" value={student.mobile} onChange={(e) => setField("mobile", e.target.value)}
                placeholder="04xx xxx xxx" type="tel"
                aria-required="true" aria-invalid={!!fieldErrors.mobile}
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.mobile ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.mobile && <FieldError>{fieldErrors.mobile}</FieldError>}
            </div>
            <div>
              <FieldLabel htmlFor="email">Email (receipt)</FieldLabel>
              <input id="email" value={student.email} onChange={(e) => setField("email", e.target.value)}
                placeholder="you@example.com" type="email"
                aria-required="true" aria-invalid={!!fieldErrors.email}
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.email ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
            </div>
          </div>
        </div>

        <SectionLabel>Delivery method</SectionLabel>
        <div className="flex flex-col gap-2 mb-4">
          {pickupEnabled && (
            <DeliveryOption
              tenant={tenant}
              on={delivery === "pickup"}
              onSelect={() => {
                setDelivery("pickup");
                posthog.capture("delivery_method_selected", { method: "pickup", tenant_id: tenant.id });
              }}
              icon={<PickupIcon size={18} />}
              title="Pickup at school office"
              sub={tenant.shopHours ? `Free · ${tenant.shopHours}` : "Free · Ready in 1–2 school days"}
            />
          )}
          {shippingEnabled && (
            <DeliveryOption
              tenant={tenant}
              on={delivery === "ship"}
              onSelect={() => {
                setDelivery("ship");
                posthog.capture("delivery_method_selected", { method: "ship", tenant_id: tenant.id });
              }}
              icon={<ShipIcon size={18} />}
              title="Ship to home"
              sub="$9.50 · 3–5 business days"
            />
          )}
        </div>

        <SectionLabel>Payment</SectionLabel>
        <div className="rounded-[10px] border bg-white p-3.5" style={{ borderColor: "var(--color-rule)" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <span
              className="h-[22px] px-2 text-white rounded text-[11px] font-bold tracking-wider flex items-center"
              style={{ background: "#635BFF" }}
            >
              stripe
            </span>
            <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
              Secure payment · PCI-DSS
            </span>
          </div>
          {!stripePublishableKey ? (
            <div className="rounded-md border px-3 py-2.5 text-[12px]" style={{ borderColor: "#B23A2A", color: "#B23A2A", background: "#FFF8F6" }}>
              Payment is unavailable because Stripe is not configured.
            </div>
          ) : (
            <div
              className="min-h-11 rounded-md border px-3 py-3 text-[13px]"
              style={{ borderColor: paymentError ? "#B23A2A" : "var(--color-rule)" }}
            >
              <div id="payment-element" ref={paymentMountRef} />
            </div>
          )}
          {paymentError && (
            <div className="mt-2 text-[11px]" style={{ color: "#B23A2A" }}>
              {paymentError}
            </div>
          )}
          <div className="mt-2.5 text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            Card details are encrypted and processed by Stripe.
          </div>
        </div>

        <div className="pt-3.5 pb-3 mt-4 border-t" style={{ borderColor: "var(--color-rule)" }}>
          <div className="flex justify-between text-[12px] mb-1" style={{ color: "var(--color-ink-dim)" }}>
            <span>Subtotal</span>
            <span className="tnum">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-1" style={{ color: "var(--color-ink-dim)" }}>
            <span>{delivery === "pickup" ? "Pickup at school office" : "Ship to home"}</span>
            <span className="tnum">{ship === 0 ? "Free" : `$${ship.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-2" style={{ color: "var(--color-ink-dim)" }}>
            <span>GST included</span>
            <span className="tnum">${gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="font-serif text-[18px] font-semibold">Total</span>
            <span className="font-serif text-[22px] font-semibold tnum">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="px-5 pt-2 pb-1">
          <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>
            Note for the school (optional)
          </label>
          <textarea
            value={parentNote}
            onChange={(e) => setParentNote(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Anything the shop should know about this order?"
            className="w-full border rounded-md px-3 py-2 text-[13px] outline-none resize-y"
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
          />
          <div className="text-[11px] mt-1" style={{ color: parentNote.length >= 500 ? "#B91C1C" : "var(--color-ink-dim)" }}>
            {parentNote.length} / 500
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 border-t bg-white flex-shrink-0" style={{ borderColor: "var(--color-rule)" }}>
        <label className="mb-2 flex items-start gap-2 text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
          <input
            type="checkbox"
            checked={acceptedPolicy}
            onChange={(e) => setAcceptedPolicy(e.target.checked)}
            className="mt-[2px]"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="underline">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              privacy policy
            </Link>
            . For refund or exchange questions, contact {tenant.name}
            {(() => {
              const validEmail =
                tenant.shopEmail?.trim().includes("@") ? tenant.shopEmail.trim() : null;
              return validEmail ? (
                <>
                  {" "}at{" "}
                  <a href={`mailto:${validEmail}`} className="underline">
                    {validEmail}
                  </a>
                </>
              ) : (
                " directly"
              );
            })()}
            .
          </span>
        </label>
        <Btn
          variant="primary"
          size="lg"
          fullWidth
          accent={tenant.accent}
          disabled={paying || paymentLocked || lines.length === 0 || !stripePublishableKey || !paymentReady}
          onClick={onPay}
          leading={<LockIcon size={14} />}
        >
          {!stripePublishableKey ? "Payment unavailable" : paymentLocked ? "Payment confirmed" : paying ? "Processing…" : `Pay $${total.toFixed(2)} securely`}
        </Btn>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-sans text-[11px] font-bold tracking-[1px] uppercase mb-2"
      style={{ color: "var(--color-ink)" }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[10.5px] font-semibold mb-1" style={{ color: "var(--color-ink-dim)" }}>
      {children}
    </label>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] mt-0.5" style={{ color: "#B23A2A" }}>
      {children}
    </div>
  );
}

function DeliveryOption({
  tenant,
  on,
  onSelect,
  icon,
  title,
  sub,
}: {
  tenant: Tenant;
  on: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-[10px] p-3 flex items-center gap-3 text-left border w-full"
      style={{
        borderColor: on ? tenant.accent : "var(--color-rule)",
        background: on ? "#FBF5F4" : "transparent",
      }}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{
          background: on ? tenant.accent : "var(--color-parchment)",
          color: on ? "#fff" : "var(--color-ink)",
        }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>{sub}</div>
      </div>
      <span
        className="w-[18px] h-[18px] rounded-full flex items-center justify-center"
        style={{
          background: on ? tenant.accent : "transparent",
          border: on ? "none" : "1.5px solid var(--color-rule)",
          color: "#fff",
        }}
      >
        {on && <CheckIcon size={11} />}
      </span>
    </button>
  );
}
