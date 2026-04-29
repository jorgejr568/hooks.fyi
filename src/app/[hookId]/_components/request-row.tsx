import { cn } from "@/lib/utils";
import { MethodBadge } from "./method-badge";
import { Paperclip } from "lucide-react";
import type { RequestSummary } from "@/types/api";

interface Props {
  request: RequestSummary;
  selected: boolean;
  onClick: () => void;
}

function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString();
}

function shortContentType(ct: string | null): string | null {
  if (!ct) return null;
  const main = ct.split(";")[0].trim();
  if (main === "application/json") return "json";
  if (main === "application/x-www-form-urlencoded") return "form";
  if (main.startsWith("multipart/form-data")) return "multipart";
  if (main.startsWith("text/")) return main.slice(5);
  if (main.startsWith("application/")) return main.slice(12);
  return main;
}

export function RequestRow({ request, selected, onClick }: Props) {
  const ct = shortContentType(request.contentType);
  const path = request.path && request.path !== "/" ? request.path : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition",
        selected
          ? "border-primary bg-primary/10"
          : "border-transparent hover:border-border hover:bg-muted/30",
      )}
    >
      <MethodBadge method={request.method} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm">
            {path ?? <span className="text-muted-foreground/70">root</span>}
          </span>
          {ct && (
            <span className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {ct}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{relTime(request.createdAt)}</span>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <span className="tabular-nums">{formatBytes(request.bodySize)}</span>
          {request.attachmentCount > 0 && (
            <>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-foreground/80">
                <Paperclip className="size-3" />
                {request.attachmentCount}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
