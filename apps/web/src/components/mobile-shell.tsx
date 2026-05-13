import type { ReactNode } from "react";

export function MobileShell({
  children,
  bg = "var(--color-paper)",
  logoUrl,
}: {
  children: ReactNode;
  bg?: string;
  logoUrl?: string;
}) {
  return (
    <div
      className="min-h-dvh w-full flex flex-col items-center sm:justify-center relative"
      style={{ background: "var(--color-parchment)" }}
    >
      {logoUrl && (
        <div className="max-w-[430px] mx-auto absolute inset-0 pointer-events-none hidden sm:block">
          <img
            alt=""
            src={logoUrl}
            className="absolute top-4 right-4 w-24 h-24 object-contain opacity-[0.08]"
          />
        </div>
      )}
      <div
        className="w-full max-w-[430px] min-h-dvh sm:min-h-0 flex flex-col sm:rounded-[10px] sm:shadow-[0_4px_32px_rgba(8,26,45,0.14),0_1px_6px_rgba(8,26,45,0.07)]"
        style={{ background: bg }}
      >
        {children}
      </div>
      <p
        className="hidden sm:block text-center text-xs mt-3 tracking-wide opacity-60"
        style={{ color: "var(--color-gold)" }}
      >
        Open on your phone for the best experience
      </p>
    </div>
  );
}
