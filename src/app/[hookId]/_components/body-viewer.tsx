"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { tryPrettyJson } from "@/lib/format/pretty-json";

interface Props {
  body: string | null;
  bodyTruncated: boolean;
  contentType: string | null;
}

export function BodyViewer({ body, bodyTruncated, contentType }: Props) {
  const [copied, setCopied] = useState(false);
  const formatted = useMemo(() => {
    if (body == null) return null;
    if ((contentType ?? "").includes("json")) return tryPrettyJson(body);
    return { isJson: false, text: body };
  }, [body, contentType]);

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
        <span className="font-mono text-xs text-muted-foreground">
          {contentType ?? "no content-type"}
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
      <pre className="max-h-[60svh] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed">
        {formatted.text}
      </pre>
    </div>
  );
}
