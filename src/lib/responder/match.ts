import { pathMatches } from "./glob";
import type { RuleSpec } from "./types";

export function matchRule(
  rules: RuleSpec[],
  method: string,
  path: string,
): RuleSpec | null {
  const upper = method.toUpperCase();
  for (const rule of rules) {
    const methodOk = rule.method === "*" || rule.method === upper;
    if (!methodOk) continue;
    if (pathMatches(rule.pathGlob, path)) return rule;
  }
  return null;
}
