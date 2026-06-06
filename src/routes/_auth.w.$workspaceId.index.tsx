import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceShell } from "@/components/hypeforce/workspace-shell";

export const Route = createFileRoute("/_auth/w/$workspaceId/")({
  component: WorkspaceIndex,
});

function WorkspaceIndex() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    (async () => {
      // On phones (<sm) we land on the channel list instead of auto-jumping
      // to the first channel — matches Slack's mobile Home flow.
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) return;
      const { data: ch } = await supabase
        .from("channels")
        .select("id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active || !ch) return;
      navigate({
        to: "/w/$workspaceId/c/$channelId",
        params: { workspaceId, channelId: ch.id },
        replace: true,
      });
    })();
    return () => {
      active = false;
    };
  }, [workspaceId, navigate]);

  return <WorkspaceShell workspaceId={workspaceId} />;
}

