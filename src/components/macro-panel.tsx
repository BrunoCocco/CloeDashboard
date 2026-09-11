import type { MacroMetric } from "@/lib/dashboard";

export function MacroPanel({ metrics }: { metrics: MacroMetric[] }) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <div><p className="metric-label">Fundamental</p><h2 className="mt-1 text-base font-semibold text-white">Macro y liquidez</h2></div>
        <span className="badge badge-muted">Últimos datos</span>
      </div>
      <div className="mt-4 divide-y divide-border">
        {metrics.map((metric) => (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_2.25rem] items-center gap-3 py-2.5" key={metric.name}>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-200">{metric.name}</p>
              {metric.source ? (
                metric.source.url ? (
                  <a className="mt-1 inline-block text-[10px] text-cyan-300/75 hover:text-cyan-300 hover:underline" href={metric.source.url} rel="noreferrer" target="_blank">
                    {metric.source.name}
                  </a>
                ) : <span className="mt-1 block text-[10px] text-muted">{metric.source.name}</span>
              ) : null}
            </div>
            <div className="text-right font-mono tabular-nums">
              <p className="text-xs font-semibold text-zinc-200">{metric.value}</p>
              <p className="mt-0.5 text-[10px] text-zinc-400">{metric.delta ?? "Variación no disponible"}</p>
            </div>
            <span className={metric.direction === "Sube" ? "inline-grid size-9 place-items-center text-3xl font-black leading-none text-emerald-300" : metric.direction === "Baja" ? "inline-grid size-9 place-items-center text-3xl font-black leading-none text-rose-300" : metric.direction === "Estable" ? "inline-grid size-9 place-items-center text-3xl font-black leading-none text-cyan-300" : metric.direction === "Mixto" ? "inline-grid size-9 place-items-center text-3xl font-black leading-none text-amber-300" : "inline-grid size-9 place-items-center text-3xl font-black leading-none text-zinc-500"} aria-label={`Dirección: ${metric.direction}`}>
              {metric.direction === "Sube" ? "↑" : metric.direction === "Baja" ? "↓" : metric.direction === "Estable" ? "→" : metric.direction === "Mixto" ? "◆" : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
