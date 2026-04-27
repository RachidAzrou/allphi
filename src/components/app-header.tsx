"use client";

import { LogOut, Menu } from "lucide-react";
import { FaCarCrash } from "react-icons/fa";
import { HiOutlineChatAlt2 } from "react-icons/hi";
import { PiFolderUserBold } from "react-icons/pi";
import {
  TbBolt,
  TbCarCrash,
  TbFileText,
  TbInbox,
  TbLayoutDashboard,
  TbTrash,
} from "react-icons/tb";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FLEET_INBOX_POLL_EVENT, isEscalationUnreadLike } from "@/lib/fleet/escalation-status";

interface AppHeaderProps {
  userEmail?: string;
  /** Volledige naam (voornaam + naam); anders wordt userEmail getoond. */
  userDisplayName?: string;
  /** Toon extra Fleet Manager navigatie (pagina's met server-side role gating). */
  showFleetManagerNav?: boolean;
}

export function AppHeader({ userEmail, userDisplayName, showFleetManagerNav }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fleetNav, setFleetNav] = useState<boolean | null>(null);
  const [inboxNewCount, setInboxNewCount] = useState(0);
  const [aangiftesNewCount, setAangiftesNewCount] = useState(0);

  const effectiveFleetNav =
    typeof showFleetManagerNav === "boolean"
      ? showFleetManagerNav
      : pathname.startsWith("/fleet-manager")
        ? true
        : fleetNav === true;

  const navIcon = "h-5 w-5";

  const navIsActive = (href: string) => {
    if (href === "/chat") return pathname === "/chat";
    if (href === "/ongeval")
      return pathname === "/ongeval" || pathname.startsWith("/ongeval/");
    if (href === "/documenten") return pathname === "/documenten";
    if (href === "/fleet-manager") return pathname === "/fleet-manager";
    if (href === "/fleet-manager/inbox") return pathname === "/fleet-manager/inbox";
    if (href === "/fleet-manager/aangiftes")
      return pathname === "/fleet-manager/aangiftes" || pathname.startsWith("/fleet-manager/aangiftes/");
    if (href === "/fleet-manager/laadkosten") return pathname === "/fleet-manager/laadkosten";
    if (href === "/fleet-manager/documenten") return pathname === "/fleet-manager/documenten";
    if (href === "/admin/purge-user") return pathname === "/admin/purge-user";
    return false;
  };

  const navigateFromSheet = (href: string) => {
    setSheetOpen(false);
    if (pathname !== href) router.push(href);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    try {
      window.localStorage.removeItem("allphi:isFleet");
    } catch {
      // ignore
    }
    setSheetOpen(false);
    router.push("/login");
  };

  const trimmedName = userDisplayName?.trim();
  const label = trimmedName || userEmail || "";
  const showEmailUnderName =
    Boolean(userEmail) && Boolean(trimmedName) && trimmedName !== userEmail;

  const handleBrandClick = () => {
    const href = effectiveFleetNav ? "/fleet-manager" : "/chat";
    if (pathname !== href) router.push(href);
  };

  const pollInboxNew = useCallback(async () => {
    if (!effectiveFleetNav) return;

    try {
      const [escRes, aangRes] = await Promise.all([
        fetch("/api/fleet-manager/escalations", { credentials: "same-origin" }),
        fetch("/api/fleet-manager/aangiftes/unread-count", { credentials: "same-origin" }),
      ]);

      if (escRes.ok) {
        const escJson = (await escRes.json()) as {
          escalations?: Array<{ id: string; status: string; created_at: string }>;
        };
        const rows = Array.isArray(escJson.escalations) ? escJson.escalations : [];
        const count = rows.filter((e) => e && isEscalationUnreadLike(e.status)).length;
        setInboxNewCount(count);
      }

      if (aangRes.ok) {
        const aangJson = (await aangRes.json()) as { ok?: boolean; count?: number };
        setAangiftesNewCount(Number(aangJson.count) || 0);
      }
    } catch {
      // ignore
    }
  }, [effectiveFleetNav]);

  useEffect(() => {
    if (!effectiveFleetNav) return;
    void pollInboxNew();
    const t = window.setInterval(() => {
      void pollInboxNew();
    }, 20000);

    const onFocus = () => void pollInboxNew();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [effectiveFleetNav, pollInboxNew]);

  useEffect(() => {
    const onInboxRefresh = () => void pollInboxNew();
    window.addEventListener(FLEET_INBOX_POLL_EVENT, onInboxRefresh);
    return () => window.removeEventListener(FLEET_INBOX_POLL_EVENT, onInboxRefresh);
  }, [pollInboxNew]);

  useEffect(() => {
    if (typeof showFleetManagerNav === "boolean") return;
    try {
      const v = window.localStorage.getItem("allphi:isFleet");
      if (v === "1") setFleetNav(true);
      else if (v === "0") setFleetNav(false);
    } catch {
      // ignore
    }
  }, [showFleetManagerNav]);

  const DesktopNavButton = (props: {
    href: string;
    label: string;
    icon: React.ReactNode;
    badgeCount?: number;
    badgeDot?: boolean;
  }) => {
    const active = navIsActive(props.href);
    const badgeLabel = useMemo(() => {
      const n = Number(props.badgeCount) || 0;
      if (n <= 0) return null;
      return n > 99 ? "99+" : String(n);
    }, [props.badgeCount]);
    return (
      <Link
        href={props.href}
        prefetch
        className={cn(
          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          active &&
            "border-transparent bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-white/15 text-white" : "bg-muted text-primary",
          )}
          aria-hidden
        >
          {props.icon}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span
            className={cn(
              "truncate text-[15px] font-medium leading-snug",
              active ? "text-white" : "text-foreground",
            )}
          >
            {props.label}
          </span>
          {props.badgeDot && (Number(props.badgeCount) || 0) > 0 ? (
            <span
              className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 ring-2 ring-red-500/20"
              aria-label="Nieuwe items"
            />
          ) : badgeLabel ? (
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-full border border-[#00A3A3]/40 bg-[#00A3A3] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white shadow-sm"
              aria-label={`${badgeLabel} nieuwe items`}
            >
              {badgeLabel}
            </span>
          ) : null}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "app-sidebar hidden lg:flex",
          "fixed left-0 top-0 z-40 h-dvh w-[var(--app-sidebar-w,18rem)] flex-col border-r border-border",
          "app-sidebar-fleet",
          "backdrop-blur-sm",
          "pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]",
        )}
        aria-label="Navigatie"
      >
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={handleBrandClick}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 active:bg-muted/60"
            aria-label="Ga naar dashboard"
          >
            <div className="stitch-gradient-fill flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/25">
              <span className="text-base font-heading font-extrabold text-white tracking-tight">
                φ
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
                Fleet Companion
              </p>
              <p className="truncate text-[12px] text-muted-foreground">{label || "—"}</p>
            </div>
          </button>
        </div>

        <div className="px-4 pt-4">
          <nav className="flex flex-col gap-2" aria-label="Hoofdnavigatie">
            {effectiveFleetNav ? (
              <>
                <DesktopNavButton
                  href="/fleet-manager"
                  label="Dashboard"
                  icon={<TbLayoutDashboard className={navIcon} aria-hidden />}
                />
                <DesktopNavButton
                  href="/fleet-manager/inbox"
                  label="Inbox"
                  icon={<TbInbox className={navIcon} aria-hidden />}
                  badgeCount={inboxNewCount}
                />
                <DesktopNavButton
                  href="/fleet-manager/aangiftes"
                  label="Aangiftes"
                  icon={<TbCarCrash className={navIcon} aria-hidden />}
                  badgeCount={aangiftesNewCount}
                  badgeDot
                />
                <DesktopNavButton
                  href="/fleet-manager/laadkosten"
                  label="Laadkosten"
                  icon={<TbBolt className={navIcon} aria-hidden />}
                />
                <DesktopNavButton
                  href="/fleet-manager/documenten"
                  label="Documenten & flows"
                  icon={<TbFileText className={navIcon} aria-hidden />}
                />
                <div className="my-1 h-px bg-border/70" aria-hidden="true" />
                <DesktopNavButton
                  href="/admin/purge-user"
                  label="Gebruikersdata"
                  icon={<TbTrash className={navIcon} aria-hidden />}
                />
              </>
            ) : (
              <>
                <DesktopNavButton
                  href="/chat"
                  label="Chat"
                  icon={<HiOutlineChatAlt2 className={navIcon} aria-hidden />}
                />
                <DesktopNavButton
                  href="/ongeval"
                  label="Mijn incidenten"
                  icon={<FaCarCrash className={navIcon} aria-hidden />}
                />
                <DesktopNavButton
                  href="/documenten"
                  label="Mijn documenten"
                  icon={<PiFolderUserBold className={navIcon} aria-hidden />}
                />
              </>
            )}
          </nav>
        </div>

        <div className="mt-auto px-4 pb-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-destructive bg-destructive text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-destructive/90 active:bg-destructive"
          >
            <LogOut className="size-5 shrink-0" strokeWidth={2} aria-hidden />
            Uitloggen
          </button>
        </div>
      </aside>

      {/* Top bar (mobile/tablet) */}
      <header
        data-app-header
        className="sticky top-0 z-50 safe-top border-b border-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 lg:z-50"
      >
        <div className="flex h-[52px] min-h-[52px] w-full items-center px-safe lg:hidden">
        {/* Balanceert het hamburgermenu rechts (zelfde breedte links en rechts) */}
        <div className="h-11 w-11 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={handleBrandClick}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-1 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 sm:justify-start"
          aria-label="Ga naar dashboard"
        >
          <div className="stitch-gradient-fill flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/25">
            <span className="text-sm font-heading font-extrabold text-white tracking-tight">
              φ
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              Fleet Companion
            </h1>
          </div>
        </button>

        <div className="flex w-11 shrink-0 justify-center">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger
              type="button"
              className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted/80 active:bg-muted"
              aria-label="Menu openen"
            >
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.75} />
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton
              className={cn(
                "chat-app-shell h-full min-h-0 gap-0 border-l border-border p-0 text-foreground shadow-lg",
                "pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] sm:max-w-sm",
              )}
            >
              <SheetTitle className="sr-only">Menu en navigatie</SheetTitle>
              <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-safe pb-3 pt-11 pr-14">
                <button
                  type="button"
                  onClick={() => navigateFromSheet("/profiel")}
                  className={cn(
                    "w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors",
                    "hover:bg-muted/50 active:bg-muted/70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    pathname === "/profiel" && "ring-1 ring-primary/25",
                  )}
                >
                  <p className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
                    {label || "—"}
                  </p>
                  {showEmailUnderName ? (
                    <p className="mt-1 break-all text-[13px] leading-snug text-muted-foreground">
                      {userEmail}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                    Profiel en account
                  </p>
                </button>

                <div className="flex justify-center py-3">
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    Navigatie
                  </span>
                </div>

                <nav
                  className="flex min-h-0 flex-1 flex-col gap-2"
                  aria-label="Hoofdnavigatie"
                >
                  {effectiveFleetNav ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/fleet-manager")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/fleet-manager") &&
                            "border-transparent bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            navIsActive("/fleet-manager") ? "bg-white/15 text-white" : "bg-muted text-primary",
                          )}
                          aria-hidden
                        >
                          <TbLayoutDashboard className={navIcon} aria-hidden />
                        </span>
                        <span
                          className={cn(
                            "text-[15px] font-medium leading-snug",
                            navIsActive("/fleet-manager") ? "text-white" : "text-foreground",
                          )}
                        >
                          Dashboard
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/fleet-manager/inbox")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/fleet-manager/inbox") &&
                            "border-transparent bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            navIsActive("/fleet-manager/inbox") ? "bg-white/15 text-white" : "bg-muted text-primary",
                          )}
                          aria-hidden
                        >
                          <TbInbox className={navIcon} aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span
                            className={cn(
                              "truncate text-[15px] font-medium leading-snug",
                              navIsActive("/fleet-manager/inbox") ? "text-white" : "text-foreground",
                            )}
                          >
                            Inbox
                          </span>
                          {inboxNewCount > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-[#00A3A3]/40 bg-[#00A3A3] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white shadow-sm">
                              {inboxNewCount > 99 ? "99+" : inboxNewCount}
                            </span>
                          ) : null}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/fleet-manager/aangiftes")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/fleet-manager/aangiftes") &&
                            "border-transparent bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            navIsActive("/fleet-manager/aangiftes")
                              ? "bg-white/15 text-white"
                              : "bg-muted text-primary",
                          )}
                          aria-hidden
                        >
                          <TbCarCrash className={navIcon} aria-hidden />
                        </span>
                        <span
                          className={cn(
                            "text-[15px] font-medium leading-snug",
                            navIsActive("/fleet-manager/aangiftes") ? "text-white" : "text-foreground",
                          )}
                        >
                          Aangiftes
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/fleet-manager/laadkosten")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/fleet-manager/laadkosten") &&
                            "border-transparent bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            navIsActive("/fleet-manager/laadkosten") ? "bg-white/15 text-white" : "bg-muted text-primary",
                          )}
                          aria-hidden
                        >
                          <TbBolt className={navIcon} aria-hidden />
                        </span>
                        <span
                          className={cn(
                            "text-[15px] font-medium leading-snug",
                            navIsActive("/fleet-manager/laadkosten") ? "text-white" : "text-foreground",
                          )}
                        >
                          Laadkosten
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/fleet-manager/documenten")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/fleet-manager/documenten") &&
                            "border-transparent bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            navIsActive("/fleet-manager/documenten") ? "bg-white/15 text-white" : "bg-muted text-primary",
                          )}
                          aria-hidden
                        >
                          <TbFileText className={navIcon} aria-hidden />
                        </span>
                        <span
                          className={cn(
                            "text-[15px] font-medium leading-snug",
                            navIsActive("/fleet-manager/documenten") ? "text-white" : "text-foreground",
                          )}
                        >
                          Documenten & flows
                        </span>
                      </button>

                      <div className="my-1 h-px bg-border/70" aria-hidden="true" />

                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/admin/purge-user")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/admin/purge-user") &&
                            "border-transparent bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            navIsActive("/admin/purge-user")
                              ? "bg-white/15 text-white"
                              : "bg-muted text-primary",
                          )}
                          aria-hidden
                        >
                          <TbTrash className={navIcon} aria-hidden />
                        </span>
                        <span
                          className={cn(
                            "text-[15px] font-medium leading-snug",
                            navIsActive("/admin/purge-user") ? "text-white" : "text-foreground",
                          )}
                        >
                          Gebruikersdata
                        </span>
                      </button>
                    </>
                  ) : null}
                  {!effectiveFleetNav ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/chat")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/chat") &&
                            "border-primary/30 bg-primary/[0.06] ring-1 ring-primary/15",
                        )}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"
                          aria-hidden
                        >
                          <HiOutlineChatAlt2 className={navIcon} aria-hidden />
                        </span>
                        <span className="text-[15px] font-medium leading-snug text-foreground">
                          Chat
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/ongeval")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/ongeval") &&
                            "border-primary/30 bg-primary/[0.06] ring-1 ring-primary/15",
                        )}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"
                          aria-hidden
                        >
                          <FaCarCrash className={navIcon} aria-hidden />
                        </span>
                        <span className="text-[15px] font-medium leading-snug text-foreground">
                          Mijn incidenten
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateFromSheet("/documenten")}
                        className={cn(
                          "flex touch-manipulation items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                          navIsActive("/documenten") &&
                            "border-primary/30 bg-primary/[0.06] ring-1 ring-primary/15",
                        )}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"
                          aria-hidden
                        >
                          <PiFolderUserBold className={navIcon} aria-hidden />
                        </span>
                        <span className="text-[15px] font-medium leading-snug text-foreground">
                          Mijn documenten
                        </span>
                      </button>
                    </>
                  ) : null}
                </nav>

                <div className="mt-4 border-t border-border pt-3 safe-bottom">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-destructive bg-destructive text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-destructive/90 active:bg-destructive"
                  >
                    <LogOut className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                    Uitloggen
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      </header>
    </>
  );
}
