"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CreateHookResponse } from "@/types/api";

export function CreateHookCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const onCreate = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/hooks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.trim() || undefined }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as CreateHookResponse;
        router.push(`/${data.id}`);
      } catch (err) {
        console.error(err);
        toast.error("Could not create hook. Try again.");
      }
    });
  };

  return (
    <Card className="w-full max-w-lg border-border/60 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Sparkles className="size-5 text-primary" />
          Spin up a new hook
        </CardTitle>
        <CardDescription>
          You&rsquo;ll get a unique URL. Send any HTTP request to it and inspect every byte right here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name <span className="text-muted-foreground">(optional)</span></Label>
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
        <Button className="w-full" size="lg" onClick={onCreate} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating&hellip;
            </>
          ) : (
            <>Create hook &rarr;</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
