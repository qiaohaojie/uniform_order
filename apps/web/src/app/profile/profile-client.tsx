"use client";

import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";

export function ProfileClient() {
  return (
    <MobileShell bg="var(--color-paper)">
      <div className="px-4 pt-3 pb-3 flex items-center flex-shrink-0">
        <div className="flex-1 text-center font-serif text-[17px] font-semibold" style={{ color: "var(--color-navy)" }}>
          Profile
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Sections added in later tasks */}
      </div>

      <BottomNav active="profile" />
    </MobileShell>
  );
}
