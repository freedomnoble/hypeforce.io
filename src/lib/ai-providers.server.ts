// Direct provider adapters used when a user has connected their own key (BYOK).
// Each adapter takes (apiKey, model, system, history) and returns the assistant
// reply as a string. Errors bubble up so the router can fall back to the gateway.

export type ProviderId = "openai" | "anthropic" | "google" | "manus";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function validateProviderKey(provider: ProviderId, apiKey: string): Promise<void> {
  // Minimal "is this key real" check per provider.
  switch (provider) {
    case "openai": {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!r.ok) throw new Error(`OpenAI rejected the key (${r.status})`);
      return;
    }
    case "anthropic": {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (r.status === 401 || r.status === 403) throw new Error("Anthropic rejected the key");
      return;
    }
    case "google": {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (!r.ok) throw new Error(`Google rejected the key (${r.status})`);
      return;
    }
    case "manus": {
      // No public validate endpoint yet; accept non-empty keys with reasonable length.
      if (apiKey.length < 16) throw new Error("Manus key looks too short");
      return;
    }
  }
}

export async function callProvider(
  provider: ProviderId,
  apiKey: string,
  model: string,
  system: string,
  history: ChatTurn[],
): Promise<string> {
  switch (provider) {
    case "openai":
      return callOpenAI(apiKey, model, system, history);
    case "anthropic":
      return callAnthropic(apiKey, model, system, history);
    case "google":
      return callGoogle(apiKey, model, system, history);
    case "manus":
      // Manus public chat-completions contract isn't wired yet — return a clear marker
      // so the router can fall back to the gateway if desired.
      throw new Error("Manus direct API not yet implemented");
  }
}

async function callOpenAI(apiKey: string, model: string, system: string, history: ChatTurn[]) {
  // Default to a sensible OpenAI chat model if the agent's stored model is a gateway slug.
  const oaModel = model.startsWith("openai/") ? model.replace("openai/", "") : "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: oaModel,
      messages: [{ role: "system", content: system }, ...history],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(apiKey: string, model: string, system: string, history: ChatTurn[]) {
  const anthModel = model.startsWith("anthropic/")
    ? model.replace("anthropic/", "")
    : "claude-3-5-sonnet-latest";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: anthModel,
      system,
      max_tokens: 1024,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.content?.[0]?.text ?? "";
}

async function callGoogle(apiKey: string, model: string, system: string, history: ChatTurn[]) {
  const gModel = model.startsWith("google/")
    ? model.replace("google/", "")
    : "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    }),
  });
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
}
