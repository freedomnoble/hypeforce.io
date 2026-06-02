// AES-GCM encryption for BYOK API keys.
// Keys are encrypted before being written to Postgres and only decrypted
// inside trusted server functions that immediately use them to call a provider.

const ALGO = "AES-GCM";

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AI_KEYS_ENCRYPTION_SECRET;
  if (!secret) throw new Error("AI_KEYS_ENCRYPTION_SECRET is not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, ALGO, false, ["encrypt", "decrypt"]);
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: ALGO, iv }, key, new TextEncoder().encode(plaintext));
  return `${toB64(iv)}:${toB64(ct)}`;
}

export async function decryptApiKey(payload: string): Promise<string> {
  const [ivB64, ctB64] = payload.split(":");
  if (!ivB64 || !ctB64) throw new Error("Malformed encrypted key");
  const key = await getKey();
  const pt = await crypto.subtle.decrypt(
    { name: ALGO, iv: fromB64(ivB64) },
    key,
    fromB64(ctB64),
  );
  return new TextDecoder().decode(pt);
}

export function maskKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  return trimmed.slice(-4);
}
