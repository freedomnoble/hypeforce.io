import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, ArrowRight, Sparkles, KeyRound, MessageCircle } from "lucide-react";

export interface TourStep {
  id: string;
  title: string;
  body: React.ReactNode;
  // CSS selector of the element to spotlight. Omit for a centered modal step.
  target?: string;
  // Where to place the tooltip relative to the target on desktop.
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  // Optional side-effect to run when entering the step (e.g. open a sheet).
  onEnter?: () => void | Promise<void>;
}

interface TourOverlayProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  onFinish: (didCompleteToEnd: boolean) => void;
  // Special final step: ask about API keys. Returning true = go to connections.
  onWantApiKeys?: () => void;
  onSkipApiKeys?: () => void;
}

const PADDING = 8;
const TOOLTIP_W = 340;

function getRect(el: Element): DOMRect {
  const r = el.getBoundingClientRect();
  return r;
}

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
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Reset to step 0 every time it opens
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Measure target
  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    // Wait a frame for any smooth scroll/layout settle, then measure.
    requestAnimationFrame(() => {
      const el2 = document.querySelector(step?.target ?? "");
      if (el2) setRect(getRect(el2));
    });
  }, [step?.target]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    let cancelled = false;
    (async () => {
      if (step.onEnter) await step.onEnter();
      if (cancelled) return;
      // give the DOM a tick after any side-effects (opening sheets etc.)
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
    const id = window.setInterval(measure, 600); // catch async DOM changes
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearInterval(id);
    };
  }, [open, measure]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        next();
      } else if (e.key === "ArrowLeft") {
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  const next = () => {
    if (isLast) {
      onFinish(true);
      return;
    }
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const tooltipStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      // Always dock to the bottom of the viewport on phones so the card
      // never overflows horizontally and can't get clipped by a target rect.
      if (!rect) {
        return { left: 12, right: 12, bottom: 16 } as React.CSSProperties;
      }
      const vh = window.innerHeight;
      const dockBottom = rect.top + rect.height / 2 < vh / 2;
      return {
        left: 12,
        right: 12,
        [dockBottom ? "bottom" : "top"]: 12,
      } as React.CSSProperties;
    }
    if (!rect) {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: `min(${TOOLTIP_W}px, calc(100vw - 24px))`,
      };
    }
    // Desktop placement
    const placement = step?.placement ?? "auto";
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const spaceRight = vw - rect.right;
    const auto: "bottom" | "top" | "right" | "left" =
      placement !== "auto"
        ? placement
        : spaceBelow > 220
          ? "bottom"
          : rect.top > 220
            ? "top"
            : spaceRight > TOOLTIP_W + 24
              ? "right"
              : "left";

    if (auto === "bottom") {
      return {
        top: rect.bottom + 14,
        left: Math.max(12, Math.min(vw - TOOLTIP_W - 12, rect.left + rect.width / 2 - TOOLTIP_W / 2)),
        width: TOOLTIP_W,
      };
    }
    if (auto === "top") {
      return {
        bottom: vh - rect.top + 14,
        left: Math.max(12, Math.min(vw - TOOLTIP_W - 12, rect.left + rect.width / 2 - TOOLTIP_W / 2)),
        width: TOOLTIP_W,
      };
    }
    if (auto === "right") {
      return {
        left: rect.right + 14,
        top: Math.max(12, Math.min(vh - 200, rect.top + rect.height / 2 - 90)),
        width: TOOLTIP_W,
      };
    }
    return {
      right: vw - rect.left + 14,
      top: Math.max(12, Math.min(vh - 200, rect.top + rect.height / 2 - 90)),
      width: TOOLTIP_W,
    };
  }, [rect, step?.placement, isMobile]);

  if (!mounted || !open || !step) return null;

  // Build the spotlight mask: a full-screen dim with a rounded rect cut out around `rect`.
  const r = rect
    ? {
        x: Math.max(0, rect.left - PADDING),
        y: Math.max(0, rect.top - PADDING),
        w: rect.width + PADDING * 2,
        h: rect.height + PADDING * 2,
        rx: 14,
      }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" aria-modal role="dialog">
      {/* Dim + spotlight via SVG mask */}
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
          fill="rgba(0,0,0,0.62)"
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

      {/* Tooltip card */}
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
          <div className="glass-strong rounded-2xl ring-1 ring-border shadow-2xl p-5 backdrop-blur-xl box-border max-w-[calc(100vw-24px)] max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
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
            <h3 className="font-display text-lg leading-tight mb-1.5">{step.title}</h3>
            <div className="text-sm text-foreground/80 leading-relaxed">{step.body}</div>

            {/* Progress dots */}
            <div className="flex items-center gap-1 mt-4 mb-3">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/15"
                  }`}
                />
              ))}
            </div>

            {step.id === "outro" ? (
              <div className="flex flex-col gap-2 mt-2">
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
              <div className="flex items-center justify-between gap-2 mt-1">
                <button
                  onClick={onClose}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Skip tour
                </button>
                <div className="flex items-center gap-2">
                  {!isFirst && (
                    <Button variant="ghost" size="sm" onClick={prev} className="gap-1">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </Button>
                  )}
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
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}

// =================================================================
// The actual workspace tour: steps + container that wires it up.
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

  // On mobile, navigating to the workspace home reveals the sidebar that
  // hosts the channels / DMs / new-channel targets (it's hidden when a
  // channel is active). Trigger it on entering any of those steps.
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
        placement: isMobile ? "auto" : "right",
        onEnter: goHomeIfMobile,
      },
      {
        id: "new-channel",
        title: "Spin up a channel anytime",
        body: <>Tap the <b>+ New</b> button to create a channel for a new project or workstream.</>,
        target: '[data-tour="new-channel-btn"]',
        placement: isMobile ? "auto" : "right",
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
        placement: isMobile ? "auto" : "right",
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
        target: isMobile
          ? '[data-tour="workspace-switcher-mobile"]'
          : '[data-tour="workspaces-rail"]',
        placement: isMobile ? "auto" : "right",
        onEnter: goHomeIfMobile,
      },
      {
        id: "agents",
        title: "Add agents to a channel",
        body: (
          <>
            Open a channel and tap the details panel on the right to add or remove agents.
            Each channel has its own roster, so you can keep specialists separate.
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
            Tap <b>More → Workspace settings</b> to set your brand voice once, plus each
            agent's role and personality. Channel-level overrides let you fine-tune per room.
          </>
        ) : (
          <>
            Open <b>Workspace settings</b> to set your brand voice once, plus each agent's role
            and personality. Channel-level overrides let you fine-tune per room.
          </>
        ),
        target: isMobile
          ? '[data-tour="mobile-more-tab"]'
          : '[data-tour="workspace-settings-btn"]',
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
