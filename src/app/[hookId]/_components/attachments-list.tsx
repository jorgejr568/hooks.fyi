"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileType,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fileExtension } from "@/lib/format/file-extension";
import type { RequestDetail } from "@/types/api";

type Attachment = RequestDetail["attachments"][number];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function categorize(ct: string | null): "image" | "pdf" | "audio" | "video" | "text" | "other" {
  const main = (ct ?? "").toLowerCase().split(";")[0].trim();
  if (main.startsWith("image/")) return "image";
  if (main === "application/pdf") return "pdf";
  if (main.startsWith("audio/")) return "audio";
  if (main.startsWith("video/")) return "video";
  if (main.startsWith("text/") || main === "application/json" || main.endsWith("+json") || main.endsWith("+xml")) return "text";
  return "other";
}

function iconFor(category: ReturnType<typeof categorize>) {
  switch (category) {
    case "image":
      return FileImage;
    case "audio":
      return FileAudio;
    case "video":
      return FileVideo;
    case "pdf":
    case "text":
      return FileType;
    default:
      return FileText;
  }
}

function AttachmentRow({ attachment, hookId }: { attachment: Attachment; hookId: string }) {
  const category = categorize(attachment.contentType);
  const previewable = category !== "other";
  const [open, setOpen] = useState(false);
  const Icon = iconFor(category);
  const ext = fileExtension(attachment.fileName, attachment.contentType);
  const baseUrl = `/api/files/${hookId}/${attachment.id}.${ext}`;
  const url = `${baseUrl}?inline=1`;

  return (
    <li>
      <div className="flex items-center gap-3 px-3 py-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm">{attachment.fileName ?? "(unnamed)"}</div>
          <div className="text-xs text-muted-foreground">
            <span className="font-mono">{attachment.fieldName ?? "—"}</span>
            <span aria-hidden> · </span>
            <span>{attachment.contentType ?? "application/octet-stream"}</span>
            <span aria-hidden> · </span>
            <span>{formatBytes(attachment.size)}</span>
          </div>
        </div>
        {previewable && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => setOpen((v) => !v)}
            title={open ? "Hide preview" : "Show preview"}
          >
            {open ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          nativeButton={false}
          className="shrink-0"
          render={<a href={baseUrl} download={attachment.fileName ?? undefined} />}
        >
          <Download className="size-4" />
        </Button>
      </div>

      {previewable && (
        <div
          className={cn(
            "grid transition-all",
            open ? "grid-rows-[1fr] border-t border-border/40" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            {open && (
              <div className="bg-zinc-950/50">
                {category === "image" && (
                  <div className="flex max-h-[60svh] items-center justify-center overflow-auto bg-[image:repeating-linear-gradient(45deg,oklch(0.10_0_0)_0_8px,oklch(0.13_0_0)_8px_16px)] p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={attachment.fileName ?? "attachment"}
                      className="max-h-[55svh] max-w-full object-contain"
                    />
                  </div>
                )}
                {category === "pdf" && (
                  <iframe src={url} className="h-[70svh] w-full" title={attachment.fileName ?? "pdf"} />
                )}
                {category === "audio" && (
                  <div className="flex items-center justify-center p-4">
                    <audio controls src={url} className="w-full max-w-md" />
                  </div>
                )}
                {category === "video" && (
                  <div className="flex items-center justify-center bg-black p-2">
                    <video controls src={url} className="max-h-[70svh] max-w-full" />
                  </div>
                )}
                {category === "text" && (
                  <iframe
                    src={url}
                    className="h-[40svh] w-full bg-zinc-950"
                    title={attachment.fileName ?? "text"}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function AttachmentsList({
  items,
  hookId,
}: {
  items: RequestDetail["attachments"];
  hookId: string;
}) {
  if (items.length === 0) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">No file attachments</p>;
  }
  return (
    <ul className="divide-y divide-border/40 overflow-hidden rounded-md border border-border/50">
      {items.map((a) => (
        <AttachmentRow key={a.id} attachment={a} hookId={hookId} />
      ))}
    </ul>
  );
}
