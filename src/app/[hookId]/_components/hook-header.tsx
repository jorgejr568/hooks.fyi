"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Check, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Props {
  hookId: string;
  name: string | null;
  createdAt: string;
  ingestUrl: string;
}

export function HookHeader({ hookId, name, createdAt, ingestUrl }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const onCopy = async () => {
    await navigator.clipboard.writeText(ingestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const onDelete = () => {
    startDelete(async () => {
      const res = await fetch(`/api/hooks/${hookId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete hook");
        return;
      }
      toast.success("Hook deleted");
      router.push("/");
    });
  };

  return (
    <header className="border-b border-border/50 bg-background/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> hooks.fyi
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {name ?? "Untitled hook"}
          </h1>
          <p className="text-xs text-muted-foreground">
            created {new Date(createdAt).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-1 items-center gap-2 sm:max-w-xl">
          <code className="flex-1 truncate rounded-md border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
            {ingestUrl}
          </code>
          <Button size="sm" variant="secondary" onClick={onCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span className="sr-only">Copy</span>
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" />
                <span className="sr-only">Delete hook</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this hook?</DialogTitle>
                <DialogDescription>
                  This permanently removes the hook, all captured requests, and any uploaded files.
                  This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" onClick={onDelete} disabled={deletePending}>
                  {deletePending ? "Deleting…" : "Delete forever"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
