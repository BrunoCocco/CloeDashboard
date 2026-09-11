import type { ReactNode } from "react";
import type { SummaryItem } from "@/lib/dashboard";

export function MarketSummary({ icon, item }: { icon: ReactNode; item: SummaryItem }) {
  return (
    <article className="panel flex min-h-28 items-center justify-between gap-3 p-4">
      <div>
        <p className="metric-label">{item.label}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <strong className="text-xl font-semibold tracking-tight text-white">{item.value}</strong>
          <span className="font-mono text-[10px] text-muted">{item.confidence}</span>
        </div>
        <p className="mt-1.5 text-xs text-zinc-400">{item.detail}</p>
      </div>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-cyan-300">{icon}</span>
    </article>
  );
}
