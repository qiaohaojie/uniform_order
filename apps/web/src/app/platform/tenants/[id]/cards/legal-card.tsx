"use client";
import { useState } from "react";
import type { TenantRow, TenantLegalVersionRow } from "@/db/schema";
import { LegalEditDrawer } from "./legal-edit-drawer";

export function LegalCard({
  tenant,
  currentVersion,
}: {
  tenant: TenantRow;
  currentVersion: TenantLegalVersionRow | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <section className="bg-paper rounded-[10px] border border-rule p-5">
        <header className="flex items-start justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold">Legal &amp; refund policy</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-ink-dim hover:text-ink underline"
          >
            Edit
          </button>
        </header>

        {currentVersion ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-rule/40 font-semibold uppercase tracking-wide">
                {currentVersion.policyMode === "text" ? "Text" : "URL"}
              </span>
              <span className="text-ink-dim">v{currentVersion.version}</span>
            </div>
            <div className="text-sm text-ink whitespace-pre-wrap">
              {currentVersion.policyMode === "text"
                ? truncate(currentVersion.policyText ?? "", 200)
                : (() => {
                    try {
                      return new URL(currentVersion.policyUrl ?? "").host;
                    } catch {
                      return currentVersion.policyUrl ?? "";
                    }
                  })()}
            </div>
            <div className="text-xs text-ink-dim border-t border-rule pt-3">
              Declared by {currentVersion.declarantName}, {currentVersion.declarantRole} ·{" "}
              {new Date(currentVersion.createdAt).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="inline-block px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-900 text-xs font-semibold uppercase tracking-wide">
              Not set
            </span>
            <p className="text-sm text-ink-dim">
              No refund policy on file. Order confirmation emails fall back to the contact line until a policy is added.
            </p>
          </div>
        )}
      </section>

      {editing ? (
        <LegalEditDrawer
          tenant={tenant}
          currentVersion={currentVersion}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}
