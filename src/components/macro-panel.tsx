import type { MacroMetric } from "@/lib/dashboard";

const sentimentClasses: Record<NonNullable<MacroMetric["tone"]>, string> = {
  "extreme-fear": "text-red-500",
  fear: "text-rose-300",
  neutral: "text-amber-300",
  greed: "text-emerald-300",
  "extreme-greed": "text-emerald-500",
  unavailable: "text-zinc-500",
};

export function MacroPanel({ metrics }: { metrics: MacroMetric[] }) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <div><p className="metric-label">Fundamental</p><h2 className="mt-1 text-base font-semibold text-white">Macro y liquidez</h2></div>
        <span className="badge badge-muted">Últimos datos</span>
      </div>
      <div className="mt-4 divide-y divide-border">
        {metrics.map((metric) => (
          <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_2.25rem]" key={metric.name}>
            <p className={`col-span-2 min-w-0 text-xs font-semibold sm:col-span-1 sm:col-start-1 sm:row-start-1 ${metric.tone ? sentimentClasses[metric.tone] : "text-zinc-200"}`}>
              {metric.name}
            </p>
            <div className="col-start-1 row-start-2 font-mono tabular-nums sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center sm:text-right">
              <p className={`text-xs font-semibold ${metric.tone ? sentimentClasses[metric.tone] : "text-zinc-200"}`}>
                {metric.value}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-400">{metric.delta ?? "Variación no disponible"}</p>
            </div>
            <span className={`${metric.direction === "Sube" ? "text-emerald-300" : metric.direction === "Baja" ? "text-rose-300" : metric.direction === "Estable" ? "text-cyan-300" : metric.direction === "Mixto" ? "text-amber-300" : "text-zinc-500"} col-start-2 row-start-2 inline-grid size-9 place-items-center text-3xl font-black leading-none sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:self-center`} aria-label={`Dirección: ${metric.direction}`}>
              {metric.direction === "Sube" ? "↑" : metric.direction === "Baja" ? "↓" : metric.direction === "Estable" ? "→" : metric.direction === "Mixto" ? "◆" : "—"}
            </span>
            <div className="col-span-2 col-start-1 row-start-3 flex flex-wrap gap-x-2 text-[10px] sm:col-span-1 sm:row-start-2">
              {metric.source ? (
                metric.source.url ? (
                  <a className="text-cyan-300/75 hover:text-cyan-300 hover:underline" href={metric.source.url} rel="noreferrer" target="_blank">
                    {metric.source.name}
                  </a>
                ) : <span className="text-muted">{metric.source.name}</span>
              ) : null}
              {metric.observedAt ? <span className="text-zinc-500">Observación: {metric.observedAt}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
