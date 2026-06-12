import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, ArrowRight, Sparkles, KeyRound, MessageCircle } from "lucide-react";

export interface TourStep {
  id: string;
  title: string;
  body: React.ReactNode;
  /** CSS selector(s) of the element to spotlight. Tried in order on each breakpoint. */
  target?: string;
  mobileTarget?: string;
  /** Where to place the tooltip relative to the target on desktop. */
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  /** Side-effect to run when entering the step (e.g. open a sheet, navigate). */
  onEnter?: () => void | Promise<void>;
}

interface TourOverlayProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  onFinish: (didCompleteToEnd: boolean) => void;
  onWantApiKeys?: () => void;
  onSkipApiKeys?: () => void;
}

const PADDING = 8;
const TOOLTIP_W = 340;
const MAX_MEASURE_ATTEMPTS = 8;

export function TourOverlay({
  steps,
  open,
  onClose,
  onFinish,
  onWantApiKeys,
  onSkipApiKeys,
}: TourOverlayProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setRect(null);
      setNotFound(false);
    }
  }, [open]);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Pick the right selector for the current breakpoint
  const activeSelector = useMemo(() => {
    if (!step) return undefined;
    if (isMobile && step.mobileTarget) return step.mobileTarget;
    return step.target;
  }, [step, isMobile]);

  // Measurement with retry — if the element isn't in the DOM yet (e.g. a
  // sheet is animating in, or we just navigated), retry a few times. After
  // MAX_MEASURE_ATTEMPTS, fall back to a centered, no-spotlight modal so the
  // tour never gets stuck on a missing element.
  const measure = useCallback(() => {
    if (!activeSelector) {
      setRect(null);
      setNotFound(false);
      return;
    }
    const el = document.querySelector(activeSelector) as HTMLElement | null;
    if (!el) {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_MEASURE_ATTEMPTS) {
        setRect(null);
        setNotFound(true);
      }
      return;
    }
    // Bring the target into view, including inside nested scroll containers.
    try {
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    } catch {
      el.scrollIntoView();
    }
    requestAnimationFrame(() => {
      const el2 = document.querySelector(activeSelector) as HTMLElement | null;
      if (el2) {
        setRect(el2.getBoundingClientRect());
        setNotFound(false);
      }
    });
  }, [activeSelector]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    let cancelled = false;
    attemptsRef.current = 0;
    setRect(null);
    setNotFound(false);
    (async () => {
      if (step.onEnter) {
        try { await step.onEnter(); } catch {}
      }
      if (cancelled) return;
      setTimeout(measure, 80);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const id = window.setInterval(measure, 500);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearInterval(id);
    };
  }, [open, measure]);

  const next = useCallback(() => {
    if (isLast) {
      onFinish(true);
      return;
    }
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [isLast, onFinish, steps.length]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, onClose]);

  // Fallback mode: no target on this step, OR target couldn't be found.
  const fallbackCentered = !activeSelector || notFound || !rect;

  const tooltipStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      // Mobile: if we have a rect, dock to the opposite side of the screen
      // from the target. Otherwise, dock to the bottom.
      if (fallbackCentered) {
        return { left: 12, right: 12, bottom: 16 } as React.CSSProperties;
      }
      const vh = window.innerHeight;
      const dockBottom = rect!.top + rect!.height / 2 < vh / 2;
      return {
        left: 12,
        right: 12,
        [dockBottom ? "bottom" : "top"]: 12,
      } as React.CSSProperties;
    }
    if (fallbackCentered) {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: `min(${TOOLTIP_W}px, calc(100vw - 24px))`,
      };
    }
    const placement = step?.placement ?? "auto";
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect!.bottom;
    const spaceRight = vw - rect!.right;
    const auto: "bottom" | "top" | "right" | "left" =
      placement !== "auto"
        ? placement
        : spaceBelow > 220
          ? "bottom"
          : rect!.top > 220
            ? "top"
            : spaceRight > TOOLTIP_W + 24
              ? "right"
              : "left";

    if (auto === "bottom") {
      return {
        top: rect!.bottom + 14,
        left: Math.max(12, Math.min(vw - TOOLTIP_W - 12, rect!.left + rect!.width / 2 - TOOLTIP_W / 2)),
        width: TOOLTIP_W,
      };
    }
    if (auto === "top") {
      return {
        bottom: vh - rect!.top + 14,
        left: Math.max(12, Math.min(vw - TOOLTIP_W - 12, rect!.left + rect!.width / 2 - TOOLTIP_W / 2)),
        width: TOOLTIP_W,
      };
    }
    if (auto === "right") {
      return {
        left: rect!.right + 14,
        top: Math.max(12, Math.min(vh - 200, rect!.top + rect!.height / 2 - 90)),
        width: TOOLTIP_W,
      };
    }
    return {
      right: vw - rect!.left + 14,
      top: Math.max(12, Math.min(vh - 200, rect!.top + rect!.height / 2 - 90)),
      width: TOOLTIP_W,
    };
  }, [rect, step?.placement, isMobile, fallbackCentered]);

  if (!mounted || !open || !step) return null;

  // Spotlight rect — skip entirely in fallback mode.
  const r = !fallbackCentered && rect
    ? {
        x: Math.max(0, rect.left - PADDING),
        y: Math.max(0, rect.top - PADDING),
        w: rect.width + PADDING * 2,
        h: rect.height + PADDING * 2,
        rx: 14,
      }
    : null;

  const progressPct = ((index + 1) / steps.length) * 100;

  return createPortal(
    <div className="fixed inset-0 z-[100]" aria-modal role="dialog">
      {/* Dim + spotlight */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={onClose}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {r && <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} ry={r.rx} fill="black" />}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={fallbackCentered ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.62)"}
          mask="url(#tour-spotlight-mask)"
        />
        {r && (
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={r.rx}
            ry={r.rx}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            className="pointer-events-none"
            style={{ filter: "drop-shadow(0 0 12px hsl(var(--primary) / 0.55))" }}
          />
        )}
      </svg>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="absolute pointer-events-auto"
          style={tooltipStyle}
        >
          <div className="glass-strong rounded-2xl ring-1 ring-border shadow-2xl backdrop-blur-xl box-border max-w-[calc(100vw-24px)] max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-electric">
                  {step.id === "outro" ? "Last step" : `Step ${index + 1} of ${steps.length}`}
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Progress bar */}
              <div className="h-1 w-full rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Body — scrolls if long */}
            <div className="px-5 pt-3 overflow-y-auto">
              <h3 className="font-display text-lg leading-tight mb-1.5">{step.title}</h3>
              <div className="text-sm text-foreground/80 leading-relaxed">{step.body}</div>
              {notFound && activeSelector && (
                <div className="mt-3 text-xs text-muted-foreground italic">
                  (Tip: this control lives in the sidebar — open the menu to see it in context.)
                </div>
              )}
            </div>

            {/* Sticky footer with Back / Next */}
            <div className="px-5 py-3 mt-2 border-t border-border/50 shrink-0 bg-background/40">
              {step.id === "outro" ? (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      onWantApiKeys?.();
                      onFinish(true);
                    }}
                    className="w-full gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    Yes — add my API keys
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onSkipApiKeys?.();
                      onFinish(true);
                    }}
                    className="w-full gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    No — start chatting
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={onClose}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    Skip
                  </button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={prev}
                      disabled={isFirst}
                      className="gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </Button>
                    <Button size="sm" onClick={next} className="gap-1">
                      {isFirst ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Start tour
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}

// =================================================================
// Workspace tour: mobile-first step definitions.
// =================================================================

interface WorkspaceTourProps {
  open: boolean;
  onClose: () => void;
  onFinish: (didComplete: boolean) => void;
  navigateHome?: () => void;
}

export function WorkspaceTour({
  open,
  onClose,
  onFinish,
  navigateHome,
}: WorkspaceTourProps) {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // On mobile, the sidebar (channels / DMs / new-channel) is hidden when a
  // channel is active. Navigate to workspace home first so the sidebar mounts.
  const goHomeIfMobile = () => {
    if (isMobile) navigateHome?.();
  };

  const steps: TourStep[] = useMemo(
    () => [
      {
        id: "welcome",
        title: "Welcome to your hypeforce",
        body: (
          <>
            A 60-second tour of how humans and AI agents work together in one workspace.
            Channels, agents, briefs, and brand voice — all in one place.
          </>
        ),
      },
      {
        id: "channels",
        title: "Channels are shared rooms",
        body: (
          <>
            One channel per project, launch, or topic. You and your agents post in the same
            thread so everyone sees the same context.
          </>
        ),
        target: '[data-tour="channels-section"]',
        mobileTarget: '[data-tour="channels-section"]',
        placement: "right",
        onEnter: goHomeIfMobile,
      },
      {
        id: "new-channel",
        title: "Spin up a channel anytime",
        body: <>Tap the <b>+ New</b> button to create a channel for a new project or workstream.</>,
        target: '[data-tour="new-channel-btn"]',
        mobileTarget: '[data-tour="new-channel-btn"]',
        placement: "right",
        onEnter: goHomeIfMobile,
      },
      {
        id: "dms",
        title: "DMs vs. channels",
        body: (
          <>
            DMs are private 1:1 threads with a single agent or teammate. Channels are shared
            with everyone in the room.
          </>
        ),
        target: '[data-tour="dms-section"]',
        mobileTarget: '[data-tour="dms-section"]',
        placement: "right",
        onEnter: goHomeIfMobile,
      },
      {
        id: "workspaces",
        title: "Switch orgs & workspaces",
        body: isMobile ? (
          <>
            Tap the <b>workspace</b> header at the top to switch orgs or create a new one
            for a different client or project portfolio.
          </>
        ) : (
          <>
            Each square is a workspace. Use <b>+</b> to add a new org for a different client or
            project portfolio.
          </>
        ),
        target: '[data-tour="workspaces-rail"]',
        mobileTarget: '[data-tour="workspace-switcher-mobile"]',
        placement: "right",
        onEnter: goHomeIfMobile,
      },
      {
        id: "agents",
        title: "Add agents to a channel",
        body: (
          <>
            Open a channel and tap the details panel to add or remove agents. Each channel
            has its own roster, so you can keep specialists separate.
          </>
        ),
      },
      {
        id: "mentions",
        title: "@-mention to call an agent",
        body: (
          <>
            In the composer, type <span className="font-mono bg-secondary/60 px-1 rounded">@</span>{" "}
            and pick an agent to direct a task at them. Skip the mention to brief everyone in
            the room at once.
          </>
        ),
      },
      {
        id: "context",
        title: "Pin context & alignment docs",
        body: (
          <>
            Pin briefs, style guides, or research in the channel details panel. Every agent
            reply uses those pinned files as context — so you don't repeat yourself.
          </>
        ),
      },
      {
        id: "brand",
        title: "Personality, roles & brand voice",
        body: isMobile ? (
          <>
            Tap <b>More → Workspace settings</b> to set your brand voice, plus each agent's
            role and personality.
          </>
        ) : (
          <>
            Open <b>Workspace settings</b> to set your brand voice once, plus each agent's role
            and personality. Channel-level overrides let you fine-tune per room.
          </>
        ),
        target: '[data-tour="workspace-settings-btn"]',
        mobileTarget: '[data-tour="mobile-more-tab"]',
        placement: isMobile ? "top" : "left",
      },
      {
        id: "outro",
        title: "Bring your own AI keys?",
        body: (
          <>
            You can start chatting right now using Hypeforce credits. Or connect your own
            OpenAI, Anthropic, or Google keys to use your provider accounts directly.
          </>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMobile, navigateHome],
  );

  return (
    <TourOverlay
      steps={steps}
      open={open}
      onClose={onClose}
      onFinish={onFinish}
      onWantApiKeys={() => {
        navigate({ to: "/profile/connections" });
      }}
      onSkipApiKeys={() => {}}
    />
  );
}
