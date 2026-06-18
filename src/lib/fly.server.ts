/**
 * Thin Fly.io Machines API client. Server-only — never import from route
 * files or *.functions.ts at module scope. Load with dynamic import inside
 * server-fn handlers.
 *
 * Docs: https://fly.io/docs/machines/api/
 */

const FLY_API = "https://api.machines.dev/v1";

function token(): string {
  const t = process.env.FLY_API_TOKEN;
  if (!t) throw new Error("FLY_API_TOKEN is not configured");
  return t;
}

function org(): string {
  const o = process.env.FLY_ORG_SLUG;
  if (!o) throw new Error("FLY_ORG_SLUG is not configured");
  return o;
}

function image(): string {
  return process.env.FLY_AGENT_IMAGE || "registry.fly.io/hypeforce-openclaw-agent:latest";
}

async function flyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${FLY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return res;
}

export type FlyMachine = {
  id: string;
  name: string;
  state: string;
  private_ip?: string;
};

export type ProvisionResult = {
  app: string;
  machineId: string;
  gatewayUrl: string;
  state: string;
};

export async function provisionAgent(opts: {
  agentId: string;
  env: Record<string, string>;
  region?: string;
}): Promise<ProvisionResult> {
  const app = `oc-${opts.agentId.slice(0, 12)}`;
  const region = opts.region || "iad";

  // 1. Create app (idempotent — ignore "already exists")
  const createApp = await flyFetch(`/apps`, {
    method: "POST",
    body: JSON.stringify({ app_name: app, org_slug: org() }),
  });
  if (!createApp.ok && createApp.status !== 422) {
    const body = await createApp.text();
    throw new Error(`fly app create failed: ${createApp.status} ${body}`);
  }

  // 2. Create machine
  const machineRes = await flyFetch(`/apps/${app}/machines`, {
    method: "POST",
    body: JSON.stringify({
      region,
      config: {
        image: image(),
        env: opts.env,
        services: [
          {
            ports: [
              { port: 443, handlers: ["tls", "http"] },
              { port: 80, handlers: ["http"] },
            ],
            protocol: "tcp",
            internal_port: 8080,
          },
        ],
        guest: { cpu_kind: "shared", cpus: 1, memory_mb: 512 },
      },
    }),
  });
  if (!machineRes.ok) {
    const body = await machineRes.text();
    throw new Error(`fly machine create failed: ${machineRes.status} ${body}`);
  }
  const machine = (await machineRes.json()) as FlyMachine;

  return {
    app,
    machineId: machine.id,
    gatewayUrl: `https://${app}.fly.dev`,
    state: machine.state,
  };
}

export async function getMachine(app: string, machineId: string): Promise<FlyMachine | null> {
  const res = await flyFetch(`/apps/${app}/machines/${machineId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fly get machine failed: ${res.status}`);
  return (await res.json()) as FlyMachine;
}

export async function restartMachine(app: string, machineId: string): Promise<void> {
  const res = await flyFetch(`/apps/${app}/machines/${machineId}/restart`, { method: "POST" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`fly restart failed: ${res.status}`);
  }
}

export async function stopMachine(app: string, machineId: string): Promise<void> {
  const res = await flyFetch(`/apps/${app}/machines/${machineId}/stop`, { method: "POST" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`fly stop failed: ${res.status}`);
  }
}

export async function destroyAgent(app: string, machineId: string): Promise<void> {
  // Best-effort: stop machine, destroy machine, destroy app.
  await flyFetch(`/apps/${app}/machines/${machineId}/stop`, { method: "POST" }).catch(() => {});
  await flyFetch(`/apps/${app}/machines/${machineId}?force=true`, { method: "DELETE" }).catch(() => {});
  await flyFetch(`/apps/${app}`, { method: "DELETE" }).catch(() => {});
}
