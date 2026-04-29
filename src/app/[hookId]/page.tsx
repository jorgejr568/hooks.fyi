import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { HookHeader } from "./_components/hook-header";
import { DashboardShell } from "./_components/dashboard-shell";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HookDashboardPage({
  params,
}: {
  params: Promise<{ hookId: string }>;
}) {
  const { hookId } = await params;
  const isUuid = UUID_RE.test(hookId);
  if (!isUuid) notFound();

  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { id: true, name: true, createdAt: true },
  });
  if (!hook) notFound();

  const protocol = env.NEXT_PUBLIC_APP_URL.startsWith("https")
    ? "https"
    : "http";
  const ingestUrl = `${protocol}://${env.HOOK_PUBLIC_HOST}/h/${hook.id}`;

  return (
    <main className="flex min-h-svh flex-col">
      <HookHeader
        hookId={hook.id}
        name={hook.name}
        createdAt={hook.createdAt.toISOString()}
        ingestUrl={ingestUrl}
      />
      <DashboardShell hookId={hook.id} />
    </main>
  );
}
