import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingLayout, StepTitle } from "@/components/onboarding/OnboardingLayout";
import {
  advanceStep,
  getOnboardingState,
  sendOnboardingInvites,
  savePendingInvites,
} from "@/lib/onboarding.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/onboarding/invites")({
  component: InvitesStep,
});

type Row = { name: string; email: string };

function InvitesStep() {
  const navigate = useNavigate();
  const fetchState = useServerFn(getOnboardingState);
  const sendInvites = useServerFn(sendOnboardingInvites);
  const savePending = useServerFn(savePendingInvites);
  const advance = useServerFn(advanceStep);

  const [me, setMe] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([
    { name: "", email: "" },
    { name: "", email: "" },
  ]);
  const [busy, setBusy] = useState<"invite" | "skip" | null>(null);

  useEffect(() => {
    (async () => {
      const s = await fetchState();
      setMe(s.display_name ?? "You");
      if (s.pending_invites?.length) {
        setRows([
          ...s.pending_invites.slice(0, 2),
          ...Array(Math.max(0, 2 - s.pending_invites.length)).fill({ name: "", email: "" }),
        ].slice(0, 2));
      }
    })();
  }, [fetchState]);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const filled = rows.filter((r) => r.name.trim() && r.email.trim());

  const goNext = async () => {
    await advance({ data: { to: 5 } });
    navigate({ to: "/onboarding/tour" });
  };

  const onInvite = async () => {
    if (!filled.length) return;
    setBusy("invite");
    try {
      const { sent } = await sendInvites({ data: { invites: filled } });
      toast.success(sent ? `Sent ${sent} invite${sent === 1 ? "" : "s"}` : "Saved");
      await goNext();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send invites");
    } finally {
      setBusy(null);
    }
  };

  const onSkip = async () => {
    setBusy("skip");
    try {
      if (filled.length) await savePending({ data: { invites: filled } });
      await goNext();
    } finally {
      setBusy(null);
    }
  };

  return (
    <OnboardingLayout step={5}>
      <StepTitle subtitle="Add up to two teammates. They'll get an email invite.">
        Bringing teammates?
      </StepTitle>

      <ul className="space-y-3 mb-5">
        <li className="flex items-center gap-3 p-3 rounded-xl bg-electric/5 border border-electric/30">
          <Avatar className="w-10 h-10">
            <AvatarFallback>{me.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium">{me}</div>
            <div className="text-xs text-muted-foreground font-mono">you</div>
          </div>
        </li>

        {rows.map((row, i) => (
          <li
            key={i}
            className="flex gap-3 p-3 rounded-xl bg-foreground/[0.04] border border-border"
          >
            <Avatar className="w-10 h-10">
              <AvatarFallback className="text-muted-foreground">
                {row.name ? row.name.slice(0, 2).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Input
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                placeholder="Name"
                className="h-9"
              />
              <Input
                value={row.email}
                onChange={(e) => updateRow(i, { email: e.target.value })}
                placeholder="Email"
                type="email"
                className="h-9"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <Button
          onClick={onInvite}
          disabled={!filled.length || busy !== null}
          className="w-full h-12"
        >
          {busy === "invite" ? "Sending…" : `Invite ${filled.length || ""}`.trim()}
        </Button>
        <Button
          onClick={onSkip}
          variant="outline"
          disabled={busy !== null}
          className="w-full h-12"
        >
          {busy === "skip" ? "…" : "Just me for now"}
        </Button>
      </div>
    </OnboardingLayout>
  );
}
