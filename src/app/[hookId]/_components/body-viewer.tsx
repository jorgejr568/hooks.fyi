"use client";

import { useMemo, useState } from "react";
import JsonView from "@uiw/react-json-view";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download } from "lucide-react";
import { tryPrettyJson } from "@/lib/format/pretty-json";

interface Props {
  body: string | null;
  bodyTruncated: boolean;
  contentType: string | null;
  /** When the full body overflowed to S3, the URL to fetch it. */
  fullBodyUrl?: string | null;
  /** Original byte count, used in the "Showing first N of M" hint. */
  fullBodySize?: number | null;
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

const TEXTUAL_CT =
  /^(application\/(json|x-www-form-urlencoded|xml|.*\+json|.*\+xml)|text\/.*)/i;

function extensionFor(ct: string | null): string {
  const main = (ct ?? "").toLowerCase().split(";")[0].trim();
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/avif": "avif",
    "application/pdf": "pdf",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/zip": "zip",
  };
  return map[main] ?? "bin";
}

type ViewMode = "decoded" | "raw";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function BodyViewer({
  body,
  bodyTruncated,
  contentType,
  fullBodyUrl,
  fullBodySize,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<ViewMode>("decoded");

  const lowerMain = (contentType ?? "").toLowerCase().split(";")[0].trim();
  const isMultipart = lowerMain.startsWith("multipart/form-data");
  const isFormUrlEncoded = lowerMain === "application/x-www-form-urlencoded";
  const isImage = lowerMain.startsWith("image/");
  const isPdf = lowerMain === "application/pdf";
  const isAudio = lowerMain.startsWith("audio/");
  const isVideo = lowerMain.startsWith("video/");
  const isBinaryPreviewable = isImage || isPdf || isAudio || isVideo;
  // The persister stores body as base64 for non-textual content.
  const bodyIsBase64 =
    !isMultipart && !!contentType && !TEXTUAL_CT.test(contentType);

  const formatted = useMemo(() => {
    if (body == null) return null;
    if (bodyIsBase64) return { isJson: false, text: body };
    return tryPrettyJson(body);
  }, [body, bodyIsBase64]);

  const parsedJson = useMemo<object | null>(() => {
    if (body == null || bodyIsBase64) return null;
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
  }, [body, bodyIsBase64, formatted, isFormUrlEncoded]);

  const dataUri = useMemo(() => {
    if (!body || !bodyIsBase64 || !isBinaryPreviewable || bodyTruncated)
      return null;
    return `data:${lowerMain};base64,${body}`;
  }, [body, bodyIsBase64, isBinaryPreviewable, bodyTruncated, lowerMain]);

  if (formatted === null) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">No body</p>;
  }

  const hasDecoded = parsedJson !== null || dataUri !== null;
  const showDecoded = hasDecoded && mode === "decoded";

  const onCopy = async () => {
    await navigator.clipboard.writeText(formatted.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const onDownload = () => {
    if (!body) return;
    const bytes = bodyIsBase64
      ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(body);
    const blob = new Blob([bytes], {
      type: lowerMain || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `request-body.${extensionFor(contentType)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-md border border-border/50">
      {bodyTruncated && fullBodyUrl && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <span>
            Showing first{" "}
            {body ? formatBytes(Buffer.byteLength(body, "utf8")) : "0 B"}
            {fullBodySize ? ` of ${formatBytes(fullBodySize)} total` : ""}.
          </span>
          <a
            href={fullBodyUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-amber-300 underline-offset-2 hover:underline"
          >
            Open full body →
          </a>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/30 px-3 py-2">
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
        <div className="flex shrink-0 items-center gap-1">
          {hasDecoded && (
            <div className="flex overflow-hidden rounded-md border border-border/60 bg-background/40 text-[10px]">
              <button
                onClick={() => setMode("decoded")}
                className={
                  "px-2 py-0.5 font-medium transition " +
                  (mode === "decoded"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                Decoded
              </button>
              <button
                onClick={() => setMode("raw")}
                className={
                  "border-l border-border/60 px-2 py-0.5 font-medium transition " +
                  (mode === "raw"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                Raw
              </button>
            </div>
          )}
          {bodyIsBase64 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={onDownload}
              title="Download body"
            >
              <Download className="size-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onCopy}
            title="Copy"
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>
      </div>

      {showDecoded && dataUri && isImage && (
        <div className="flex max-h-[60svh] items-center justify-center overflow-auto bg-[image:repeating-linear-gradient(45deg,oklch(0.10_0_0)_0_8px,oklch(0.13_0_0)_8px_16px)] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUri}
            alt="request body"
            className="max-h-[55svh] max-w-full object-contain"
          />
        </div>
      )}

      {showDecoded && dataUri && isPdf && (
        <iframe
          src={dataUri}
          className="h-[70svh] w-full bg-zinc-950"
          title="PDF preview"
        />
      )}

      {showDecoded && dataUri && isAudio && (
        <div className="flex items-center justify-center p-4">
          <audio controls src={dataUri} className="w-full max-w-md" />
        </div>
      )}

      {showDecoded && dataUri && isVideo && (
        <div className="flex items-center justify-center bg-black p-2">
          <video controls src={dataUri} className="max-h-[70svh] max-w-full" />
        </div>
      )}

      {showDecoded && !dataUri && parsedJson !== null && (
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
      )}

      {(!showDecoded || (!dataUri && parsedJson === null)) && (
        <>
          {isBinaryPreviewable && bodyTruncated && mode === "decoded" && (
            <div className="border-b border-border/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
              Body too large to preview. Showing the truncated base64 payload
              below.
            </div>
          )}
          <pre className="max-h-[60svh] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
            {formatted.text}
          </pre>
        </>
      )}
    </div>
  );
}
