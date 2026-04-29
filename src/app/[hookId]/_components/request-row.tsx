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
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function RequestRow({ request, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition",
        selected
          ? "border-primary bg-primary/10"
          : "border-transparent hover:bg-muted/40 hover:border-border",
      )}
    >
      <MethodBadge method={request.method} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm">{request.path || "/"}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{relTime(request.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>{formatBytes(request.bodySize)}</span>
          {request.attachmentCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
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
