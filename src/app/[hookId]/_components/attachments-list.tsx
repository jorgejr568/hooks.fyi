import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RequestDetail } from "@/types/api";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function AttachmentsList({ items }: { items: RequestDetail["attachments"] }) {
  if (items.length === 0) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">No file attachments</p>;
  }
  return (
    <ul className="divide-y divide-border/40 overflow-hidden rounded-md border border-border/50">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 px-3 py-2">
          <FileText className="size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-sm">{a.fileName ?? "(unnamed)"}</div>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{a.fieldName ?? "—"}</span>
              <span aria-hidden> · </span>
              <span>{a.contentType ?? "application/octet-stream"}</span>
              <span aria-hidden> · </span>
              <span>{formatBytes(a.size)}</span>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary">
            <a href={`/api/files/${a.id}`} download>
              <Download className="size-4" />
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}
