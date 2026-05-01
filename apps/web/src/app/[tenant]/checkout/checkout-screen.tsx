"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { Tenant } from "@/lib/data";
import { cartTotal } from "@/lib/data";
import { useCart } from "@/lib/cart-store";
import { Btn } from "@/components/btn";
import { BackIcon, CheckIcon, LockIcon, PickupIcon, ShipIcon } from "@/components/icons";
import { readStudentDetails, writeStudentDetails, type StudentDetails } from "@/lib/order-store";

type Delivery = "pickup" | "ship";

const YEAR_OPTIONS = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"];

export function CheckoutScreen({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const { lines, clearCart } = useCart();
  const [delivery, setDelivery] = useState<Delivery>("pickup");
  const [paying, setPaying] = useState(false);
  const [student, setStudent] = useState<StudentDetails>({
    studentName: "", rollClass: "", year: "Year 9",
    parentName: "", mobile: "", email: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof StudentDetails, string>>>({});

  useEffect(() => {
    const saved = readStudentDetails();
    if (saved) setStudent(saved);
  }, []);

  const subtotal = cartTotal(lines);
  const ship = delivery === "ship" ? 9.5 : 0;
  const total = subtotal + ship;
  const gst = total / 11;

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
    if (!validate()) return;
    writeStudentDetails(student);
    setPaying(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          parentName: student.parentName,
          parentEmail: student.email,
          parentMobile: student.mobile,
          studentName: student.studentName,
          studentYear: student.year,
          studentRoll: student.rollClass,
          delivery,
          deliveryFee: delivery === "ship" ? 9.5 : 0,
          subtotal,
          gst,
          total,
          stripePaymentIntentId: null,
          lines: lines.map((l) => ({
            itemId: l.itemId,
            itemName: l.name,
            variantLabel: l.variantLabel,
            qty: l.qty,
            unitPrice: l.price,
            lineTotal: l.price * l.qty,
          })),
        }),
      });
      if (res.ok) {
        const { orderId } = await res.json();
        clearCart();
        router.push(`/${tenant.id}/order/placed?total=${total.toFixed(2)}&delivery=${delivery}&orderId=${orderId}`);
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to place order. Please try again.");
        setPaying(false);
      }
    } catch (err) {
      console.error("Order submission error:", err);
      alert("Network error. Please try again.");
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
              <FieldLabel>Student name</FieldLabel>
              <input value={student.studentName} onChange={(e) => setField("studentName", e.target.value)}
                placeholder="e.g. Riley Qiao"
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.studentName ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.studentName && <FieldError>{fieldErrors.studentName}</FieldError>}
            </div>
            <div>
              <FieldLabel>Year</FieldLabel>
              <select value={student.year} onChange={(e) => setField("year", e.target.value)}
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none bg-white"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Roll class</FieldLabel>
              <input value={student.rollClass} onChange={(e) => setField("rollClass", e.target.value)}
                placeholder="e.g. 9F"
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.rollClass ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.rollClass && <FieldError>{fieldErrors.rollClass}</FieldError>}
            </div>
          </div>
          <div className="h-px mb-3" style={{ background: "var(--color-rule)" }} />
          <div className="flex flex-col gap-2.5">
            <div>
              <FieldLabel>Parent / guardian name</FieldLabel>
              <input value={student.parentName} onChange={(e) => setField("parentName", e.target.value)}
                placeholder="e.g. George Qiao"
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.parentName ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.parentName && <FieldError>{fieldErrors.parentName}</FieldError>}
            </div>
            <div>
              <FieldLabel>Mobile</FieldLabel>
              <input value={student.mobile} onChange={(e) => setField("mobile", e.target.value)}
                placeholder="04xx xxx xxx" type="tel"
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.mobile ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.mobile && <FieldError>{fieldErrors.mobile}</FieldError>}
            </div>
            <div>
              <FieldLabel>Email (receipt)</FieldLabel>
              <input value={student.email} onChange={(e) => setField("email", e.target.value)}
                placeholder="you@example.com" type="email"
                className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: fieldErrors.email ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
              {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
            </div>
          </div>
        </div>

        <SectionLabel>Delivery method</SectionLabel>
        <div className="flex flex-col gap-2 mb-4">
          <DeliveryOption
            tenant={tenant}
            on={delivery === "pickup"}
            onSelect={() => setDelivery("pickup")}
            icon={<PickupIcon size={18} />}
            title="Pickup at school office"
            sub="Free · Ready in 1–2 school days"
          />
          <DeliveryOption
            tenant={tenant}
            on={delivery === "ship"}
            onSelect={() => setDelivery("ship")}
            icon={<ShipIcon size={18} />}
            title="Ship to home"
            sub="$9.50 · 3–5 business days"
          />
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
          <div
            className="h-11 rounded-md border px-3 flex items-center justify-between mb-2 text-[13px]"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <span className="tnum tracking-[1px]" style={{ color: "var(--color-ink)" }}>5240 1468 0020 4745</span>
            <span className="flex gap-1">
              <span className="w-6 h-3.5 rounded-[1px] opacity-85" style={{ background: "#EB001B" }} />
              <span className="w-6 h-3.5 rounded-[1px] opacity-85 -ml-2" style={{ background: "#F79E1B" }} />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-11 rounded-md border px-3 flex items-center text-[13px] tnum" style={{ borderColor: "var(--color-rule)" }}>09 / 29</div>
            <div className="h-11 rounded-md border px-3 flex items-center text-[13px] tnum" style={{ borderColor: "var(--color-rule)" }}>•••</div>
          </div>
          <div className="mt-2.5 text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            Saved as <b style={{ color: "var(--color-ink)" }}>•• 4745</b> · Mastercard
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
      </div>

      <div className="px-4 pt-3 pb-6 border-t bg-white flex-shrink-0" style={{ borderColor: "var(--color-rule)" }}>
        <Btn
          variant="primary"
          size="lg"
          fullWidth
          accent={tenant.accent}
          disabled={paying || lines.length === 0}
          onClick={onPay}
          leading={<LockIcon size={14} />}
        >
          {paying ? "Processing…" : `Pay $${total.toFixed(2)} securely`}
        </Btn>
        <div className="text-center text-[10.5px] mt-2" style={{ color: "var(--color-ink-dim)" }}>
          By placing this order you agree to {tenant.short}&apos;s refund policy.
        </div>
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold mb-1" style={{ color: "var(--color-ink-dim)" }}>
      {children}
    </div>
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
