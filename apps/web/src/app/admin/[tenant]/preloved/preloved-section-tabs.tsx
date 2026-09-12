"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { Tabs } from "@heroui/react";

const BASE_TABS = [
  { id: "intake", label: "Intake" },
  { id: "stock", label: "Stock" },
  { id: "inbox", label: "Inbox" },
  { id: "write-offs", label: "Write-offs" },
] as const;

const CONSIGNMENTS_TAB = { id: "consignments", label: "Consignments" } as const;

type PrelovedSectionTabId =
  | (typeof BASE_TABS)[number]["id"]
  | typeof CONSIGNMENTS_TAB.id;

function selectedPrelovedSection(
  pathname: string,
  tabs: readonly { id: PrelovedSectionTabId; label: string }[],
): PrelovedSectionTabId {
  const match = tabs.find(
    (tab) =>
      pathname.endsWith(`/preloved/${tab.id}`) ||
      pathname.includes(`/preloved/${tab.id}/`),
  );
  return match?.id ?? "intake";
}

export function PrelovedSectionTabs({
  tenantId,
  showConsignments = false,
}: {
  tenantId: string;
  showConsignments?: boolean;
}) {
  const pathname = usePathname();
  const tabs = showConsignments
    ? ([...BASE_TABS, CONSIGNMENTS_TAB] as const)
    : BASE_TABS;
  const selectedKey = selectedPrelovedSection(pathname, tabs);

  return (
    <Tabs variant="secondary" selectedKey={selectedKey} className="w-full">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Preloved sections">
          {tabs.map((tab) => {
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
