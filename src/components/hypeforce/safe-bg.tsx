import { Component, lazy, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";

const InfiniteGridBg = lazy(() =>
  import("./infinite-grid-bg")
    .then((m) => ({ default: m.InfiniteGridBg }))
    .catch(() => ({ default: () => null })),
);

class BgBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    // Chunk load failure or render error in background — non-fatal.
    // eslint-disable-next-line no-console
    console.warn("[SafeBg] background failed, rendering null", err);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * Decorative background. Lazy-loaded, never throws to the parent route.
 * If the chunk 404s (stale build), it silently renders nothing.
 */
export function SafeBg({ interactive = false }: { interactive?: boolean }) {
  return (
    <BgBoundary>
      <ClientOnly fallback={null}>
        <InfiniteGridBg interactive={interactive} />
      </ClientOnly>
    </BgBoundary>
  );
}
