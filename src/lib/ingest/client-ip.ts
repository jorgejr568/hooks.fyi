import { env } from "@/lib/env";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const x = Number(part);
    if (!Number.isInteger(x) || x < 0 || x > 255) return null;
    n = (n << 8) + x;
  }
  return n >>> 0;
}

type ParsedAllow =
  | { kind: "exact"; value: string }
  | { kind: "cidr"; net: number; mask: number };

let cached: { src: string; rules: ParsedAllow[] } | null = null;

function rules(): ParsedAllow[] {
  const src = env.TRUSTED_PROXY_IPS;
  if (cached && cached.src === src) return cached.rules;
  const out: ParsedAllow[] = [];
  for (const raw of src.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.includes("/")) {
      const [ip, bitsStr] = trimmed.split("/");
      const bits = Number(bitsStr);
      const intIp = ipv4ToInt(ip);
      if (intIp == null || !Number.isInteger(bits) || bits < 0 || bits > 32) continue;
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      out.push({ kind: "cidr", net: intIp & mask, mask });
    } else {
      out.push({ kind: "exact", value: trimmed });
    }
  }
  cached = { src, rules: out };
  return out;
}

function isTrusted(peerIp: string | null): boolean {
  if (!peerIp) return false;
  const list = rules();
  if (list.length === 0) return false;
  const intIp = ipv4ToInt(peerIp);
  for (const r of list) {
    if (r.kind === "exact" && r.value === peerIp) return true;
    if (r.kind === "cidr" && intIp != null && (intIp & r.mask) === r.net) return true;
  }
  return false;
}

export function clientIp(req: Request, peerIp: string | null): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff && isTrusted(peerIp)) {
    return xff.split(",")[0].trim();
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return peerIp ?? "unknown";
}
