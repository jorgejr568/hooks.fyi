"use client";

import {
  useState,
  useTransition,
  useRef,
  useEffect,
  KeyboardEvent,
} from "react";
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
import { Copy, Check, Trash2, ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ResponderDialog } from "./responder-dialog";

interface Props {
  hookId: string;
  name: string | null;
  createdAt: string;
  ingestUrl: string;
}

export function HookHeader({
  hookId,
  name: initialName,
  createdAt,
  ingestUrl,
}: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const [name, setName] = useState<string | null>(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

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

  const startEdit = () => {
    setDraft(name ?? "");
    setEditing(true);
  };

  const commit = async () => {
    if (!editing) return;
    const trimmed = draft.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    setEditing(false);
    if (next === name) return;
    const previous = name;
    setName(next);
    try {
      const res = await fetch(`/api/hooks/${hookId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      setName(previous);
      toast.error("Could not save name");
    }
  };

  const cancel = () => {
    setDraft(name ?? "");
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">hooks.fyi</span>
          </Link>
          <span
            aria-hidden
            className="hidden text-muted-foreground/40 sm:inline"
          >
            /
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                maxLength={120}
                placeholder="Untitled hook"
                className="w-full max-w-xs rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-sm font-semibold tracking-tight outline-none focus:border-primary"
              />
            ) : (
              <h1
                onDoubleClick={startEdit}
                title="Double-click to rename"
                className="group inline-flex min-w-0 cursor-text items-center gap-1.5"
              >
                <span className="truncate text-sm font-semibold tracking-tight">
                  {name ?? (
                    <span className="text-muted-foreground">Untitled hook</span>
                  )}
                </span>
                <Pencil className="size-3 shrink-0 text-muted-foreground/0 transition group-hover:text-muted-foreground/60" />
              </h1>
            )}
            <span className="hidden whitespace-nowrap text-[11px] text-muted-foreground/70 md:inline">
              · {new Date(createdAt).toLocaleString()}
            </span>
          </div>

          <ResponderDialog hookId={hookId} />

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                />
              }
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Delete hook</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this hook?</DialogTitle>
                <DialogDescription>
                  This permanently removes the hook, all captured requests, and
                  any uploaded files. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={onDelete}
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting…" : "Delete forever"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 font-mono text-xs">
            {ingestUrl}
          </code>
          <Button
            size="sm"
            variant="secondary"
            onClick={onCopy}
            className="shrink-0"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span className="sr-only">Copy URL</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
