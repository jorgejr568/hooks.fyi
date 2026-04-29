import { cn } from "@/lib/utils";
import { methodColor } from "@/lib/format/method-color";

const tones: Record<string, string> = {
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  zinc: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

export function MethodBadge({ method, className }: { method: string; className?: string }) {
  const tone = tones[methodColor(method)];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
        tone,
        className,
      )}
    >
      {method}
    </span>
  );
}
