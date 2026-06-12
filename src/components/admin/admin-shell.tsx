import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { WebBackground } from "./web-background";
import {
  LayoutDashboard,
  Users,
  LifeBuoy,
  FileText,
  CreditCard,
  Flag,
  Gift,
  LogOut,
  Menu,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/pretentious", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/pretentious/users", label: "Users", icon: Users },
  { to: "/pretentious/support", label: "Support", icon: LifeBuoy },
  { to: "/pretentious/landing", label: "Landing CMS", icon: FileText },
  { to: "/pretentious/billing", label: "Billing", icon: CreditCard },
  { to: "/pretentious/invites", label: "Invites", icon: Gift },
  { to: "/pretentious/flags", label: "Feature Flags", icon: Flag },
];

export function AdminShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const backToApp = () => navigate({ to: "/app" });

  return (
    <div className="admin-root min-h-screen text-foreground">
      <WebBackground />

      <header className="sticky top-0 z-20 px-3 sm:px-4 pt-3 sm:pt-4">
        <nav className="mx-auto max-w-7xl backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex items-center justify-between px-3 py-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-display text-lg pl-1 sm:pl-2 pr-1 sm:pr-3 tracking-tight shrink-0">
              <span className="text-white/90">pretentious</span>
              <span className="text-purple-300/70">.</span>
            </div>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV.map((n) => {
                const active = n.exact ? path === n.to : path.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all ${
                      active
                        ? "bg-white/15 text-white shadow-inner border border-white/20"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={backToApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to app
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-white/80 hover:text-white hover:bg-white/5"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 bg-neutral-950 border-white/10 text-white">
              <div className="px-5 pt-6 pb-4 border-b border-white/10">
                <div className="font-display text-lg tracking-tight">
                  <span className="text-white/90">pretentious</span>
                  <span className="text-purple-300/70">.</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono mt-1">
                  Admin console
                </div>
              </div>
              <div className="py-2">
                {NAV.map((n) => {
                  const active = n.exact ? path === n.to : path.startsWith(n.to);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setMobileNavOpen(false)}
                      className={`flex items-center gap-3 px-5 py-3 text-sm ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {n.label}
                    </Link>
                  );
                })}
                <div className="h-px bg-white/10 my-2 mx-5" />
                <button
                  onClick={() => {
                    setMobileNavOpen(false);
                    backToApp();
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to app
                </button>
                <button
                  onClick={() => {
                    setMobileNavOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] ${className}`}
    >
      {children}
    </div>
  );
}
