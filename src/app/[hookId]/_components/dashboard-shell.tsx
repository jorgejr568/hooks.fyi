"use client";

import { useState } from "react";
import { RequestList } from "./request-list";
import { RequestDetail } from "./request-detail";

export function DashboardShell({ hookId }: { hookId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-px overflow-hidden border-x border-border/50 bg-border/40 lg:grid-cols-[380px_1fr]">
      <RequestList hookId={hookId} selectedId={selectedId} onSelect={setSelectedId} />
      <RequestDetail hookId={hookId} requestId={selectedId} />
    </div>
  );
}
