import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hook not found</h1>
      <p className="mt-3 text-muted-foreground">
        The hook you&rsquo;re looking for has been deleted or never existed.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Create a new hook</Link>
      </Button>
    </main>
  );
}
