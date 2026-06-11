import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  component: LegalLayout,
});

function LegalLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold hover:opacity-80">
            ← Hypeforce
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/legal/refunds" className="hover:text-foreground">Refunds</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-10 prose prose-invert prose-sm sm:prose-base">
        <Outlet />
      </main>
    </div>
  );
}
