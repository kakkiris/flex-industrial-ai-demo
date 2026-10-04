"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FlexOps AI Demo Suite";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  kind: string | null;
  title: string | null;
  body: string | null;
  link: string | null;
  // Drizzle timestamp columns serialize to ISO strings through NextResponse.json,
  // so the client receives strings even though the server-side type is Date.
  createdAt: string | number | null;
  readAt: string | number | null;
}

interface NotificationsResponse {
  data: Notification[] | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return "";
  const diffMs = Date.now() - ms;
  const diffSec = Math.floor(diffMs / 1_000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopBar() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<NotificationsResponse>;
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const badgeLabel =
    unreadCount === 0 ? null : unreadCount > 9 ? "9+" : String(unreadCount);

  async function handleMarkAllRead() {
    await fetch("/api/notifications", { method: "PUT" });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <header className="h-14 flex items-center justify-between border-b border-border bg-background px-6 shrink-0">
      {/* Left: app identity */}
      <div className="flex flex-col leading-tight gap-0.5">
        <span className="text-sm font-semibold text-foreground">{APP_NAME}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
          FlexOps AI <span className="text-primary mx-0.5">×</span> KFP
        </span>
      </div>

      {/* Right: notifications bell. Unread badge uses rose tone (semantic alert)
          instead of brand-indigo so brand indigo stays scarce. */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open notifications"
          onClick={() => setSheetOpen(true)}
          className="relative"
        >
          <Bell className="size-5" />
          {badgeLabel && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center rounded-full font-mono font-medium bg-[var(--tone-rose-tint)] text-[var(--tone-rose-text)] border border-[var(--tone-rose-dot)]/40">
              {badgeLabel}
            </span>
          )}
        </Button>

        <Sheet open={sheetOpen} onOpenChange={(v) => setSheetOpen(v)}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>
                Recent system events for the demo suite.
              </SheetDescription>
            </SheetHeader>

            {notifications.length > 0 && (
              <div className="px-4 pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleMarkAllRead}
                >
                  Mark all read
                </Button>
              </div>
            )}

            <ScrollArea className="flex-1 px-4 pb-4">
              {notifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {notifications.slice(0, 20).map((n) => (
                    <li
                      key={n.id}
                      className={`rounded-md border p-3 text-sm ${
                        n.readAt ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {n.kind && (
                            <span className="inline-block mb-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {n.kind}
                            </span>
                          )}
                          {n.title && (
                            <p className="font-medium leading-snug">{n.title}</p>
                          )}
                          {n.body && (
                            <p className="mt-0.5 text-muted-foreground leading-snug">
                              {n.body}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                          {relativeTime(n.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
