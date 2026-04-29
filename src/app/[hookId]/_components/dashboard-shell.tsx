"use client";

import { useState } from "react";
import { RequestList } from "./request-list";
import { RequestDetail } from "./request-detail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardShell({ hookId }: { hookId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-1 overflow-hidden border-x border-border/50 lg:gap-px lg:bg-border/40">
      <aside
        className={cn(
          "flex w-full flex-col bg-background lg:w-[360px] lg:shrink-0 lg:border-r lg:border-border/50",
          selectedId && "hidden lg:flex",
        )}
      >
        <RequestList hookId={hookId} selectedId={selectedId} onSelect={setSelectedId} />
      </aside>

      <section
        className={cn(
          "flex min-w-0 flex-1 flex-col bg-background",
          !selectedId && "hidden lg:flex",
        )}
      >
        {selectedId && (
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2 lg:hidden">
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="size-4" />
              <span className="ml-1">Back</span>
            </Button>
          </div>
        )}
        <RequestDetail hookId={hookId} requestId={selectedId} />
      </section>
    </div>
  );
}
