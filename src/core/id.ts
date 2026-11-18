const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(now = Date.now()): string {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) { time = ALPHABET[t % 32] + time; t = Math.floor(t / 32); }
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  let out = time;
  for (let i = 0; i < 16; i++) out += ALPHABET[rand[i] % 32];
  return out;
}

export function entityId(kind: string): string {
  return `mf_${kind}_${ulid().toLowerCase()}`;
}

export function slug(input: string, max = 80): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, max) || "unknown";
}

export function sha256(input: string): string {
  return new Bun.CryptoHasher("sha256").update(input).digest("hex");
}

export function normalizeTitle(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/['’`]/g, "").replace(/\b(the|a|an)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a); const y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const setA = new Set(x.split(" ").filter(Boolean));
  const setB = new Set(y.split(" ").filter(Boolean));
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = new Set([...setA, ...setB]).size || 1;
  return inter / union;
}
