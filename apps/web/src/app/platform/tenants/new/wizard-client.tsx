"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { TenantRow } from "@/db/schema";
import { Step1Identity } from "./steps/step-1-identity";
import { Step2Branding } from "./steps/step-2-branding";
import { Step3Stripe } from "./steps/step-3-stripe";
import { Step4Operator } from "./steps/step-4-operator";
import { Step5Catalog } from "./steps/step-5-catalog";
import { Step6GoLive } from "./steps/step-6-go-live";

export function WizardClient({
  tenant,
  initialStep,
  catalogCount,
}: {
  tenant: TenantRow | null;
  initialStep: 1 | 2 | 3 | 4 | 5 | 6;
  catalogCount: number;
}) {
  const [step, setStep] = useState(initialStep);
  const router = useRouter();
  const sp = useSearchParams();

  function goto(nextStep: 1 | 2 | 3 | 4 | 5 | 6, id?: string) {
    const params = new URLSearchParams(sp ?? "");
    params.set("step", String(nextStep));
    if (id) params.set("id", id);
    router.push(`/platform/tenants/new?${params.toString()}`);
    setStep(nextStep);
  }

  return (
    <div className="flex-1 px-7 py-6 overflow-auto">
      <StepRail step={step} />
      <div className="mt-6 grid grid-cols-[1fr_360px] gap-6">
        <div className="bg-paper rounded-[10px] border border-rule p-7">
          {step === 1 && <Step1Identity tenant={tenant} onContinue={(id) => goto(2, id)} />}
          {step === 2 && tenant && <Step2Branding tenant={tenant} onContinue={() => goto(3)} />}
          {step === 3 && tenant && <Step3Stripe tenant={tenant} onContinue={() => goto(4)} />}
          {step === 4 && tenant && <Step4Operator tenant={tenant} onContinue={() => goto(5)} />}
          {step === 5 && tenant && <Step5Catalog tenant={tenant} onContinue={() => goto(6)} />}
          {step === 6 && tenant && <Step6GoLive tenant={tenant} catalogCount={catalogCount} />}
        </div>
        {step === 2 && tenant && <LivePreview accent={tenant.accent} logoUrl={tenant.logoUrl} short={tenant.short} />}
      </div>
    </div>
  );
}

function StepRail({ step }: { step: number }) {
  const labels = ["Identity", "Branding", "Stripe", "Operator", "Catalog", "Go live"];
  return (
    <div className="flex gap-2">
      {labels.map((l, i) => (
        <div key={l} className={`flex-1 text-center text-xs font-semibold rounded-md py-2 ${
          i + 1 === step ? "bg-navy-deep text-white"
          : i + 1 < step ? "bg-green-100 text-green-800"
          : "bg-rule text-ink-dim"
        }`}>
          {i + 1}. {l}
        </div>
      ))}
    </div>
  );
}

function LivePreview({ accent, logoUrl, short }: { accent: string; logoUrl: string | null; short: string }) {
  return (
    <aside className="bg-paper rounded-[10px] border border-rule p-4 sticky top-6">
      <div className="text-[10.5px] uppercase tracking-[0.6px] font-bold text-ink-dim">
        Live preview · Parent
      </div>
      <div className="mt-3 rounded-2xl border-8 border-ink overflow-hidden bg-white">
        <div style={{ background: accent }} className="px-4 py-5 text-white">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-8 h-8 rounded" />
            ) : (
              <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center text-xs font-bold">
                {short.slice(0, 3)}
              </div>
            )}
            <div className="font-serif text-sm font-semibold">{short} Uniform Shop</div>
          </div>
        </div>
        <div className="p-3.5 text-xs text-ink-dim">Catalog preview…</div>
      </div>
    </aside>
  );
}
