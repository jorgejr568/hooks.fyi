"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestRow } from "./request-row";
import { Inbox, Loader2 } from "lucide-react";
import type { RequestSummary } from "@/types/api";

interface Props {
  hookId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface ListResponse {
  items: RequestSummary[];
  nextCursor: string | null;
}

export function RequestList({ hookId, selectedId, onSelect }: Props) {
  const [items, setItems] = useState<RequestSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [live, setLive] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadInitial = useCallback(async () => {
    const res = await fetch(`/api/hooks/${hookId}/requests`);
    const data = (await res.json()) as ListResponse;
    setItems(data.items);
    setNextCursor(data.nextCursor);
    if (data.items.length > 0 && !selectedId) onSelect(data.items[0].id);
  }, [hookId, selectedId, onSelect]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/hooks/${hookId}/requests?cursor=${nextCursor}`);
      const data = (await res.json()) as ListResponse;
      setItems((prev) => [...(prev ?? []), ...data.items]);
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [hookId, nextCursor, loadingMore]);

  const fetchAndPrepend = useCallback(async (sinceIso: string) => {
    const res = await fetch(`/api/hooks/${hookId}/requests?since=${encodeURIComponent(sinceIso)}`);
    const data = (await res.json()) as ListResponse;
    if (data.items.length === 0) return;
    setItems((prev) => {
      const existing = new Set((prev ?? []).map((r) => r.id));
      const fresh = data.items.filter((r) => !existing.has(r.id));
      return [...fresh, ...(prev ?? [])];
    });
  }, [hookId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const es = new EventSource(`/api/hooks/${hookId}/stream`);
    eventSourceRef.current = es;
    es.addEventListener("ready", () => setLive(true));
    es.addEventListener("request.created", () => {
      setItems((prev) => {
        const newest = prev?.[0]?.createdAt ?? new Date(0).toISOString();
        fetchAndPrepend(newest);
        return prev;
      });
    });
    es.onerror = () => setLive(false);
    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [hookId, fetchAndPrepend]);

  return (
    <aside className="flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Requests</span>
          <span className="text-xs text-muted-foreground">{items?.length ?? 0}</span>
        </div>
        <span
          className={
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium " +
            (live
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-zinc-500/15 text-muted-foreground")
          }
        >
          <span
            className={
              "size-1.5 rounded-full " +
              (live ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70" : "bg-zinc-400")
            }
          />
          {live ? "live" : "offline"}
        </span>
      </div>

      <ScrollArea className="h-[calc(100svh-180px)]">
        {items === null ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Inbox className="mb-3 size-10 text-muted-foreground/60" />
            <p className="text-sm font-medium">No requests yet</p>
            <p className="mt-1 max-w-[24ch] text-xs text-muted-foreground">
              Send a request to your hook URL and it will appear here instantly.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((r) => (
              <li key={r.id}>
                <RequestRow
                  request={r}
                  selected={r.id === selectedId}
                  onClick={() => onSelect(r.id)}
                />
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div className="p-4">
            <Button variant="ghost" size="sm" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="size-4 animate-spin" /> : "Load older"}
            </Button>
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
