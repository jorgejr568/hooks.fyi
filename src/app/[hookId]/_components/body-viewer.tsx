"use client";

import { useMemo, useState } from "react";
import JsonView from "@uiw/react-json-view";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { tryPrettyJson } from "@/lib/format/pretty-json";

interface Props {
  body: string | null;
  bodyTruncated: boolean;
  contentType: string | null;
}

const jsonTheme = {
  "--w-rjv-font-family": "var(--font-mono)",
  "--w-rjv-color": "oklch(0.78 0.18 153)",
  "--w-rjv-key-number": "oklch(0.78 0.18 153)",
  "--w-rjv-key-string": "oklch(0.78 0.18 153)",
  "--w-rjv-background-color": "transparent",
  "--w-rjv-line-color": "oklch(0.20 0 0)",
  "--w-rjv-arrow-color": "oklch(0.55 0 0)",
  "--w-rjv-edit-color": "oklch(0.78 0.18 153)",
  "--w-rjv-info-color": "oklch(0.55 0 0)",
  "--w-rjv-update-color": "oklch(0.78 0.18 153)",
  "--w-rjv-copied-color": "oklch(0.78 0.18 153)",
  "--w-rjv-copied-success-color": "oklch(0.78 0.18 153)",
  "--w-rjv-curlybraces-color": "oklch(0.55 0 0)",
  "--w-rjv-colon-color": "oklch(0.55 0 0)",
  "--w-rjv-brackets-color": "oklch(0.55 0 0)",
  "--w-rjv-ellipsis-color": "oklch(0.65 0 0)",
  "--w-rjv-quotes-color": "oklch(0.55 0 0)",
  "--w-rjv-quotes-string-color": "oklch(0.78 0.10 90)",
  "--w-rjv-type-string-color": "oklch(0.78 0.10 90)",
  "--w-rjv-type-int-color": "oklch(0.72 0.18 250)",
  "--w-rjv-type-float-color": "oklch(0.72 0.18 250)",
  "--w-rjv-type-bigint-color": "oklch(0.72 0.18 250)",
  "--w-rjv-type-boolean-color": "oklch(0.78 0.18 30)",
  "--w-rjv-type-date-color": "oklch(0.78 0.18 30)",
  "--w-rjv-type-url-color": "oklch(0.72 0.18 250)",
  "--w-rjv-type-null-color": "oklch(0.55 0 0)",
  "--w-rjv-type-undefined-color": "oklch(0.55 0 0)",
  "--w-rjv-type-nan-color": "oklch(0.55 0 0)",
  "--w-rjv-key-quotes-color": "oklch(0.78 0.18 153)",
  "--w-rjv-key-string-color": "oklch(0.85 0 0)",
} as React.CSSProperties;

export function BodyViewer({ body, bodyTruncated, contentType }: Props) {
  const [copied, setCopied] = useState(false);

  const formatted = useMemo(() => {
    if (body == null) return null;
    return tryPrettyJson(body);
  }, [body]);

  const isMultipart = (contentType ?? "").toLowerCase().startsWith("multipart/form-data");
  const isFormUrlEncoded = (contentType ?? "")
    .toLowerCase()
    .startsWith("application/x-www-form-urlencoded");

  const parsedJson = useMemo<object | null>(() => {
    if (body == null) return null;
    if (isFormUrlEncoded) {
      try {
        const params = new URLSearchParams(body);
        const out: Record<string, string | string[]> = {};
        for (const key of new Set(Array.from(params.keys()))) {
          const all = params.getAll(key);
          out[key] = all.length === 1 ? all[0] : all;
        }
        return Object.keys(out).length > 0 ? out : null;
      } catch {
        return null;
      }
    }
    if (!formatted?.isJson) return null;
    try {
      const v = JSON.parse(formatted.text);
      return v && typeof v === "object" ? (v as object) : null;
    } catch {
      return null;
    }
  }, [body, formatted, isFormUrlEncoded]);

  if (formatted === null) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">No body</p>;
  }

  const onCopy = async () => {
    await navigator.clipboard.writeText(formatted.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="overflow-hidden rounded-md border border-border/50">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-3 py-2">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {contentType ?? "no content-type"}
          {isMultipart && parsedJson !== null && (
            <span className="ml-2 rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
              text fields
            </span>
          )}
          {isFormUrlEncoded && parsedJson !== null && (
            <span className="ml-2 rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
              decoded
            </span>
          )}
          {bodyTruncated && (
            <span className="ml-2 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
              truncated
            </span>
          )}
        </span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onCopy}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
      {parsedJson !== null ? (
        <div className="max-h-[60svh] overflow-auto px-3 py-2 font-mono text-xs">
          <JsonView
            value={parsedJson}
            collapsed={3}
            displayDataTypes={false}
            displayObjectSize={true}
            indentWidth={16}
            enableClipboard={true}
            shortenTextAfterLength={120}
            style={jsonTheme}
          />
        </div>
      ) : (
        <pre className="max-h-[60svh] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
          {formatted.text}
        </pre>
      )}
    </div>
  );
}
