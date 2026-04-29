export type MethodTone =
  | "sky"
  | "emerald"
  | "amber"
  | "violet"
  | "rose"
  | "zinc";

const map: Record<string, MethodTone> = {
  GET: "sky",
  POST: "emerald",
  PUT: "amber",
  PATCH: "violet",
  DELETE: "rose",
};

export function methodColor(method: string): MethodTone {
  return map[method.toUpperCase()] ?? "zinc";
}
