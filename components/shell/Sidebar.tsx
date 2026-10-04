"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BarChart3,
  ClipboardList,
  FileText,
  Search,
  DatabaseZap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Visual revamp 2026-05-27. Sidebar uses a near-black-chrome
// hand: the active state is a charcoal left rule + foreground label on white,
// not a brand-indigo fill. Nav grouped into Acquisitions and Leasing tracks with
// Plex Mono section caps. The wordmark uses brand indigo only on the "×" between
// FlexOps AI and KFP, the single brand placement in chrome.

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

type NavSection = {
  label: string;
  items: readonly NavItem[];
};

const NAV: readonly NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Home", path: "/", icon: Home },
    ],
  },
  {
    label: "Acquisitions",
    items: [
      { label: "A1 Market Intelligence", path: "/market-intelligence", icon: BarChart3 },
      { label: "A5 Acquisition Bulk-Load", path: "/acquisition-bulk-load", icon: DatabaseZap },
    ],
  },
  {
    label: "Leasing",
    items: [
      { label: "L1 Leasing Qualification", path: "/chat-leasing", icon: ClipboardList },
      { label: "L2 Lease Abstraction", path: "/lease-abstraction", icon: FileText },
      { label: "C3 Lease Intelligence", path: "/lease-intelligence", icon: Search },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] flex flex-col border-r border-border bg-background-subtle z-40">
      {/* Wordmark lockup */}
      <div className="px-5 pt-6 pb-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/80 leading-none">
          <span>FlexOps AI</span>
          <span className="text-primary mx-1.5" aria-hidden="true">×</span>
          <span>KFP</span>
        </div>
        <p className="mt-1.5 text-[10.5px] font-mono uppercase tracking-[0.08em] text-foreground-muted">
          AI Workflow Demos
        </p>
      </div>

      <div className="border-t border-border" />

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map((section) => (
          <div key={section.label}>
            {section.label !== "Overview" ? (
              <p className="px-2 mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-faint">
                {section.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map(({ label, path, icon: Icon }) => {
                const isActive = pathname === path;
                return (
                  <Link
                    key={path}
                    href={path}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-sm pl-3 pr-2.5 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-background text-foreground"
                        : "text-foreground-muted hover:bg-foreground/[0.04] hover:text-foreground"
                    )}
                  >
                    {isActive ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-foreground rounded-full"
                      />
                    ) : null}
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-faint">
          Demo build · 2026-05
        </p>
      </div>
    </aside>
  );
}
