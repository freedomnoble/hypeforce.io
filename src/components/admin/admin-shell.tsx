import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { WebBackground } from "./web-background";
import { LayoutDashboard, Users, LifeBuoy, FileText, CreditCard, Flag, Gift, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

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

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="admin-root min-h-screen text-foreground">
      <WebBackground />

      <header className="sticky top-0 z-20 px-4 pt-4">
        <nav className="mx-auto max-w-7xl backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="font-display text-lg pl-2 pr-3 tracking-tight">
              <span className="text-white/90">pretentious</span>
              <span className="text-purple-300/70">.</span>
            </div>
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
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">
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
