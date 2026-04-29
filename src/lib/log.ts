import pino, { type LoggerOptions } from "pino";

/**
 * Structured logger backed by pino.
 *
 * Env knobs:
 *   - LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace" (default "info")
 *   - LOG_JSON:  "true" → raw JSON to stdout (production-friendly).
 *                "false" → pretty-printed via pino-pretty (dev-friendly).
 *                Unset → JSON in production, pretty otherwise.
 */
function resolveJsonMode(): boolean {
  const raw = process.env.LOG_JSON;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return process.env.NODE_ENV === "production";
}

function build(): pino.Logger {
  const level = (process.env.LOG_LEVEL ?? "info") as pino.Level;
  const useJson = resolveJsonMode();

  const opts: LoggerOptions = { level };
  if (!useJson) {
    opts.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
        singleLine: false,
      },
    };
  }
  return pino(opts);
}

const globalForLog = globalThis as unknown as { logger: pino.Logger | undefined };
export const logger: pino.Logger = globalForLog.logger ?? build();
if (process.env.NODE_ENV !== "production") globalForLog.logger = logger;
