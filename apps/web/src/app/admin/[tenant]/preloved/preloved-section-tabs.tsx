"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { Tabs } from "@heroui/react";

const PRELOVED_SECTION_TABS = [
  { id: "intake", label: "Intake" },
  { id: "stock", label: "Stock" },
  { id: "inbox", label: "Inbox" },
  { id: "write-offs", label: "Write-offs" },
] as const;

type PrelovedSectionTabId = (typeof PRELOVED_SECTION_TABS)[number]["id"];

function selectedPrelovedSection(pathname: string): PrelovedSectionTabId {
  const match = PRELOVED_SECTION_TABS.find(
    (tab) =>
      pathname.endsWith(`/preloved/${tab.id}`) ||
      pathname.includes(`/preloved/${tab.id}/`),
  );
  return match?.id ?? "intake";
}

export function PrelovedSectionTabs({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const selectedKey = selectedPrelovedSection(pathname);

  return (
    <Tabs variant="secondary" selectedKey={selectedKey} className="w-full">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Preloved sections">
          {PRELOVED_SECTION_TABS.map((tab) => {
            const href = `/admin/${tenantId}/preloved/${tab.id}`;
            return (
              <Tabs.Tab
                key={tab.id}
                id={tab.id}
                href={href}
                render={(domProps) => (
                  <Link
                    {...(domProps as unknown as ComponentProps<typeof Link>)}
                    href={href}
                  />
                )}
              >
                {tab.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            );
          })}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
