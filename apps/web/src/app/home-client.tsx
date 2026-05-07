"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ParentChildRow } from "@/db/queries";
import { Crest } from "@/components/crest";
import { PlatformMark } from "@/components/platform-mark";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { MobileShell } from "@/components/mobile-shell";
import { ChildFormModal, type TenantOption } from "./child-form-modal";
import {
  setActiveChildCookieClient,
  readActiveChildCookieClient,
  clearActiveChildCookieClient,
} from "@/lib/active-child.client";
import type { TenantId } from "@/lib/data";

type TenantBrandRow = {
  id: string;
  name: string;
  short: string;
  accent: string;
  motto: string | null;
};

type Props =
  | {
      mode: "logged-out";
      tenants: TenantBrandRow[];
    }
  | {
      mode: "logged-in";
      userFirstName: string;
      tenants: TenantBrandRow[];
      children: (ParentChildRow & { needsYearConfirm: boolean })[];
      tenantById: Record<string, TenantBrandRow>;
    };

function tenantToBrand(t: TenantBrandRow) {
  return {
    id: t.id as TenantId,
    name: t.name,
    short: t.short,
    accent: t.accent,
    accentInk: "#FFFFFF",
    motto: t.motto ?? "",
    address: "",
    shopHours: "",
    shopEmail: "",
  };
}

export function HomeClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [modal, setModal] = useState<
    | { open: false }
    | { open: true; mode: "add" }
    | { open: true; mode: "edit"; child: ParentChildRow }
  >({ open: false });
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (props.mode !== "logged-in") return;
    if (searchParams.get("action") === "add-child") {
      setModal({ open: true, mode: "add" });
    }
  }, [props.mode, searchParams]);

  const refresh = () => startTransition(() => router.refresh());

  if (props.mode === "logged-out") {
    return (
      <MobileShell bg="var(--color-parchment)">
        <div className="px-6 pt-6 pb-2">
          <PlatformMark size={26} />
        </div>

        <div className="px-6 pt-6 pb-2">
          <div className="text-[11px] font-bold tracking-[1.4px] uppercase" style={{ color: "var(--color-gold)" }}>
            Welcome
          </div>
          <h1 className="font-serif text-[28px] font-medium mt-2 mb-1.5 leading-[1.15] tracking-[-0.4px]">
            Find your school.
          </h1>
          <p className="text-[14px] leading-[1.5] m-0" style={{ color: "var(--color-ink-dim)" }}>
            Tap a school to start shopping. Sign in to save your children for next time.
          </p>
        </div>

        <div className="px-5 py-6 flex flex-col gap-3.5 flex-1">
          {props.tenants.map((t) => (
            <Link
              key={t.id}
              href={`/${t.id}`}
              className="bg-white rounded-[14px] border p-4 flex items-center gap-4 transition-all hover:shadow-md"
              style={{
                borderColor: "var(--color-rule)",
                boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.18)",
              }}
            >
              <Crest tenant={tenantToBrand(t)} size={56} />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[18px] font-semibold leading-[1.15] mb-1" style={{ color: "var(--color-ink)" }}>
                  {t.short}
                </div>
                <div className="text-[12px] leading-[1.4]" style={{ color: "var(--color-ink-dim)" }}>
                  {t.name}
                </div>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                style={{ background: "var(--color-navy)" }}
              >
                <ChevronRightIcon size={14} />
              </div>
            </Link>
          ))}
        </div>

        <div className="px-6 pb-6">
          <Link
            href="/auth/sign-in?callbackURL=%2F%3Faction%3Dadd-child"
            className="block w-full text-center bg-transparent border border-dashed rounded-[14px] p-4 text-[13px] font-medium"
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-dim)" }}
          >
            Sign in to save your children
          </Link>
        </div>
      </MobileShell>
    );
  }

  const onTapChild = (c: ParentChildRow) => {
    setActiveChildCookieClient(c.id);
    router.push(`/${c.tenantId}`);
  };

  const onConfirmYear = async (id: string) => {
    await fetch(`/api/parent/children/${id}/confirm`, { method: "POST" });
    refresh();
  };

  const requestRemove = (id: string, name: string) => setRemoveTarget({ id, name });

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const { id } = removeTarget;
    setRemoveTarget(null);
    setRemovingId(id);
    try {
      await fetch(`/api/parent/children/${id}`, { method: "DELETE" });
      if (readActiveChildCookieClient() === id) {
        clearActiveChildCookieClient();
      }
      refresh();
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <MobileShell bg="var(--color-parchment)">
      <div className="px-6 pt-6 pb-2">
        <PlatformMark size={26} />
      </div>

      <div className="px-6 pt-6 pb-2">
        <div className="text-[11px] font-bold tracking-[1.4px] uppercase" style={{ color: "var(--color-gold)" }}>
          Welcome back
        </div>
        <h1 className="font-serif text-[30px] font-medium mt-2 mb-1.5 leading-[1.15] tracking-[-0.4px]">
          Good morning,
          <br />
          {props.userFirstName}.
        </h1>
        <p className="text-[14px] leading-[1.5] m-0" style={{ color: "var(--color-ink-dim)" }}>
          Whose uniform are we shopping for today?
        </p>
      </div>

      <div className="px-5 py-6 flex flex-col gap-3.5 flex-1">
        {props.children.map((c) => {
          const tenant = props.tenantById[c.tenantId];
          if (!tenant) return null;
          return (
            <div
              key={c.id}
              className="bg-white rounded-[14px] border p-4 flex flex-col gap-2"
              style={{
                borderColor: "var(--color-rule)",
                boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.18)",
              }}
            >
              <button
                type="button"
                className="flex items-center gap-4 w-full text-left"
                onClick={() => onTapChild(c)}
              >
                <Crest tenant={tenantToBrand(tenant)} size={56} />
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[18px] font-semibold leading-[1.15] mb-1" style={{ color: "var(--color-ink)" }}>
                    {c.name}
                  </div>
                  <div className="text-[12px] leading-[1.4]" style={{ color: "var(--color-ink-dim)" }}>
                    {tenant.name}
                  </div>
                  <div className="text-[11px] mt-0.5 font-medium" style={{ color: "var(--color-ink-dim)" }}>
                    Year {c.year}
                  </div>
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: "var(--color-navy)" }}
                >
                  <ChevronRightIcon size={14} />
                </div>
              </button>

              {c.needsYearConfirm && (
                <div className="flex items-center gap-2 text-[11.5px] pt-2" style={{ borderTop: "1px solid var(--color-rule)", color: "var(--color-ink-dim)" }}>
                  <span>Still in Year {c.year} this year?</span>
                  <button
                    onClick={() => onConfirmYear(c.id)}
                    className="px-2 h-6 rounded text-white text-[11px]"
                    style={{ background: "var(--color-navy)" }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setModal({ open: true, mode: "edit", child: c })}
                    className="px-2 h-6 rounded text-[11px]"
                    style={{ background: "var(--color-parchment)", color: "var(--color-ink)" }}
                  >
                    Edit
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                <button onClick={() => setModal({ open: true, mode: "edit", child: c })}>Edit</button>
                <button
                  onClick={() => requestRemove(c.id, c.name)}
                  disabled={removingId === c.id}
                  style={{ color: "#B91C1C" }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setModal({ open: true, mode: "add" })}
          className="bg-transparent border border-dashed rounded-[14px] p-4 text-[13px] font-medium flex items-center justify-center gap-2"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-dim)" }}
        >
          <PlusIcon size={16} />
          Add another child
        </button>
      </div>

      <div className="px-6 pb-6 text-[11px] text-center" style={{ color: "var(--color-ink-dim)" }}>
        <Link href="/privacy" className="underline">Privacy notice</Link>
      </div>

      {modal.open && (
        <ChildFormModal
          open
          mode={modal.mode}
          initial={
            modal.mode === "edit"
              ? {
                  id: modal.child.id,
                  tenantId: modal.child.tenantId,
                  name: modal.child.name,
                  year: modal.child.year,
                  rollClass: modal.child.rollClass,
                }
              : {}
          }
          tenants={props.tenants.map((t) => ({ id: t.id, name: t.short })) satisfies TenantOption[]}
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            refresh();
          }}
        />
      )}

      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-confirm-title"
        >
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-sm mx-4 p-6"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <h2 id="remove-confirm-title" className="font-serif text-[18px] font-semibold mb-2" style={{ color: "var(--color-ink)" }}>
              Remove {removeTarget.name}?
            </h2>
            <p className="text-[13px] mb-5" style={{ color: "var(--color-ink-dim)" }}>
              Past orders are not affected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="px-4 h-9 rounded-md text-[13px]"
                style={{ background: "var(--color-parchment)", color: "var(--color-ink)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                className="px-4 h-9 rounded-md text-[13px] text-white"
                style={{ background: "#B91C1C" }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileShell>
  );
}
