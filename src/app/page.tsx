import { CreateHookCard } from "./_components/create-hook-card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-svh max-w-6xl flex-col items-center justify-center px-6 py-16">
      <div className="absolute inset-x-0 top-0 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-sm font-mono">
          <span className="size-2 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/70" />
          <span className="font-semibold tracking-tight">hooks.fyi</span>
        </div>
        <a
          className="text-sm text-muted-foreground hover:text-foreground"
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
        >
          source &rarr;
        </a>
      </div>

      <div className="mb-10 flex flex-col items-center text-center">
        <Badge variant="secondary" className="mb-6 rounded-full px-3 py-1 text-xs font-medium">
          No login. No setup. Just a URL.
        </Badge>
        <h1 className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-balance text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
          A request bin that captures everything.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-muted-foreground">
          Inspect headers, bodies, and file uploads in real time. Built for debugging webhooks,
          callbacks, and integrations you&rsquo;d rather not stand up a server for.
        </p>
      </div>

      <CreateHookCard />

      <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <Feature label="Any method" value="GET, POST, PUT, PATCH, DELETE, &hellip;" />
        <Feature label="Any body" value="JSON, form, multipart, binary" />
        <Feature label="Any file" value="up to 50 MB per upload" />
      </div>
    </main>
  );
}

function Feature({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div
        className="mt-1 font-mono text-foreground"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}
