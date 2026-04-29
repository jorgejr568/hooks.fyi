const RE_META = /[.+?^${}()|[\]\\]/g;

function stripTrailingSlash(s: string): string {
  if (s.length > 1 && s.endsWith("/")) return s.slice(0, -1);
  return s;
}

export function globToRegex(glob: string): RegExp {
  if (glob.length === 0) {
    throw new Error("globToRegex: glob must be non-empty");
  }
  const normalized = stripTrailingSlash(glob);
  let out = "";
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i];
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        out += ".*";
        i += 2;
      } else {
        out += "[^/]+";
        i += 1;
      }
    } else if (c === "/" && normalized.slice(i + 1, i + 3) === "**") {
      // "/**" → "(?:/.*)?" so the leading slash + tail are both optional
      out += "(?:/.*)?";
      i += 3;
    } else {
      out += c.replace(RE_META, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
}

export function pathMatches(glob: string, path: string): boolean {
  const re = globToRegex(glob);
  return re.test(stripTrailingSlash(path));
}
