"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { CreateHookResponse } from "@/types/api";

type Created = Pick<CreateHookResponse, "id" | "url" | "ownerToken">;

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy.");
    }
  };
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground/70">
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 font-mono text-xs">
          {secret ? "•".repeat(Math.min(value.length, 32)) : value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={onCopy} className="cursor-pointer">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function CreateHookCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<Created | null>(null);

  const onCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch("/api/hooks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim() || undefined }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as CreateHookResponse;
        setCreated({ id: data.id, url: data.url, ownerToken: data.ownerToken });
      } catch (err) {
        console.error(err);
        toast.error("Could not create hook. Try again.");
      }
    });
  };

  if (created) {
    return (
      <Card className="w-full max-w-lg border-border/60 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="size-5 text-primary" /> Bin ready
          </CardTitle>
          <CardDescription>
            Send any HTTP request to the URL below. Save the owner token —
            it&rsquo;s required to delete the bin or change its responder,
            and we won&rsquo;t show it again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyRow label="Ingest URL" value={created.url} />
          <CopyRow label="Owner token" value={created.ownerToken} secret />
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            className="w-full cursor-pointer"
            size="lg"
            onClick={() => router.push(`/${created.id}`)}
          >
            Continue to dashboard &rarr;
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg border-border/60 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Sparkles className="size-5 text-primary" />
          Spin up a new hook
        </CardTitle>
        <CardDescription>
          You&rsquo;ll get a unique URL. Send any HTTP request to it and inspect
          every byte right here.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onCreate}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Stripe sandbox webhook"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              disabled={pending}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full cursor-pointer"
            size="lg"
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Creating&hellip;
              </>
            ) : (
              <>Create hook &rarr;</>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
