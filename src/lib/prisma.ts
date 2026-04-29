import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "@/lib/log";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const adapter = new PrismaPg({ connectionString: url });

  const log: Prisma.LogDefinition[] = [
    { emit: "event", level: "warn" },
    { emit: "event", level: "error" },
    { emit: "event", level: "info" },
  ];
  if ((process.env.LOG_LEVEL ?? "info") === "debug" || process.env.LOG_LEVEL === "trace") {
    log.push({ emit: "event", level: "query" });
  }

  const client = new PrismaClient({ adapter, log });
  const prismaLog = logger.child({ component: "prisma" });

  client.$on("warn", (e) => prismaLog.warn({ target: e.target }, e.message));
  client.$on("error", (e) => prismaLog.error({ target: e.target }, e.message));
  client.$on("info", (e) => prismaLog.info({ target: e.target }, e.message));
  client.$on("query", (e) =>
    prismaLog.debug(
      { duration: e.duration, params: e.params, target: e.target },
      e.query,
    ),
  );

  return client;
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = buildClient();
  }
  return globalForPrisma.prisma;
}

// Lazy proxy: importing `prisma` is safe at build time when DATABASE_URL is
// unset; the client is constructed on first property access.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
}) as PrismaClient;
