"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MethodBadge } from "./method-badge";
import { KvTable } from "./kv-table";
import { BodyViewer } from "./body-viewer";
import { AttachmentsList } from "./attachments-list";
import type { RequestDetail as RequestDetailDto } from "@/types/api";

interface Props {
  hookId: string;
  requestId: string | null;
}

export function RequestDetail({ hookId, requestId }: Props) {
  const [detail, setDetail] = useState<RequestDetailDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/hooks/${hookId}/requests/${requestId}`)
      .then((r) => r.json() as Promise<RequestDetailDto>)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hookId, requestId]);

  if (!requestId) {
    return (
      <section className="flex items-center justify-center bg-background p-10 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Select a request from the left, or send one to your hook URL to see it appear here.
        </p>
      </section>
    );
  }

  if (loading || !detail) {
    return (
      <section className="space-y-4 bg-background p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col bg-background">
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <MethodBadge method={detail.method} className="text-xs" />
          <code className="truncate font-mono text-sm">{detail.path || "/"}</code>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{new Date(detail.createdAt).toLocaleString()}</span>
          {detail.ip && <span className="font-mono">ip: {detail.ip}</span>}
          {detail.userAgent && (
            <span className="truncate font-mono" title={detail.userAgent}>
              ua: {detail.userAgent}
            </span>
          )}
        </div>
      </div>

      <Tabs defaultValue="body" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-6 mt-4 self-start">
          <TabsTrigger value="body">
            Body{detail.body ? "" : " (empty)"}
          </TabsTrigger>
          <TabsTrigger value="headers">
            Headers <span className="ml-1 text-muted-foreground">({Object.keys(detail.headers).length})</span>
          </TabsTrigger>
          <TabsTrigger value="query">
            Query <span className="ml-1 text-muted-foreground">({Object.keys(detail.query).length})</span>
          </TabsTrigger>
          <TabsTrigger value="files">
            Files <span className="ml-1 text-muted-foreground">({detail.attachments.length})</span>
          </TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-auto px-6 py-4">
          <TabsContent value="body">
            <BodyViewer
              body={detail.body}
              bodyTruncated={detail.bodyTruncated}
              contentType={detail.contentType}
            />
          </TabsContent>
          <TabsContent value="headers">
            <KvTable data={detail.headers} emptyLabel="No headers" />
          </TabsContent>
          <TabsContent value="query">
            <KvTable data={detail.query} emptyLabel="No query parameters" />
          </TabsContent>
          <TabsContent value="files">
            <AttachmentsList items={detail.attachments} hookId={hookId} />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
