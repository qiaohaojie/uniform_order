import Link from "next/link";
import { redirect } from "next/navigation";
import { PARENT, TENANTS } from "@/lib/data";
import { Crest } from "@/components/crest";
import { PlatformMark } from "@/components/platform-mark";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { MobileShell } from "@/components/mobile-shell";

// Parent home / school picker. Auto-skips to the catalog when there's only
// one kid (single-school parent), shows a card list otherwise.
export default function Home() {
  if (PARENT.kids.length === 1) {
    redirect(`/${PARENT.kids[0].tenantId}`);
  }

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
          {PARENT.name.split(" ")[0]}.
        </h1>
        <p className="text-[14px] leading-[1.5] m-0" style={{ color: "var(--color-ink-dim)" }}>
          Whose uniform are we shopping for today?
        </p>
      </div>

      <div className="px-5 py-6 flex flex-col gap-3.5 flex-1">
        {PARENT.kids.map((k) => {
          const tenant = TENANTS[k.tenantId];
          return (
            <Link
              key={k.name}
              href={`/${tenant.id}`}
              className="bg-white rounded-[14px] border p-4 flex items-center gap-4 transition-all hover:shadow-md"
              style={{
                borderColor: "var(--color-rule)",
                boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.18)",
              }}
            >
              <Crest tenant={tenant} size={56} />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[18px] font-semibold leading-[1.15] mb-1" style={{ color: "var(--color-ink)" }}>
                  {k.name}
                </div>
                <div className="text-[12px] leading-[1.4]" style={{ color: "var(--color-ink-dim)" }}>
                  {tenant.name}
                </div>
                <div className="text-[11px] mt-0.5 font-medium" style={{ color: "var(--color-ink-dim)" }}>
                  {k.year}
                </div>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                style={{ background: "var(--color-navy)" }}
              >
                <ChevronRightIcon size={14} />
              </div>
            </Link>
          );
        })}
        <button
          className="bg-transparent border border-dashed rounded-[14px] p-4 text-[13px] font-medium flex items-center justify-center gap-2"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-dim)" }}
        >
          <PlusIcon size={16} />
          Add another child
        </button>
      </div>

      <div className="px-6 pb-6 text-[11px] text-center" style={{ color: "var(--color-ink-dim)" }}>
        Switch schools any time from your profile.
      </div>
    </MobileShell>
  );
}
