import type { ReactNode } from "react";

// Container that constrains the parent-flow screens to a phone-ish width on
// desktop while letting them go full-bleed on real phones. Drops the
// design-canvas iPhone chrome (status bar, notch) since this is a real web
// app — those were artifacts of the design preview canvas.
export function MobileShell({
  children,
  bg = "var(--color-paper)",
}: {
  children: ReactNode;
  bg?: string;
}) {
  return (
    <div className="min-h-dvh w-full flex justify-center" style={{ background: "var(--color-parchment)" }}>
      <div
        className="w-full max-w-[430px] min-h-dvh flex flex-col"
        style={{ background: bg }}
      >
        {children}
      </div>
    </div>
  );
}
