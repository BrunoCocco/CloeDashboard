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
          <div className="grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-3 py-2.5" key={metric.name}>
            <p className="text-xs font-medium text-zinc-200">{metric.name}</p>
            <span className="text-right font-mono text-xs text-zinc-300">{metric.value}</span>
            <span className={metric.direction === "Sube" ? "inline-grid size-8 place-items-center text-2xl font-black leading-none text-emerald-300" : metric.direction === "Baja" ? "inline-grid size-8 place-items-center text-2xl font-black leading-none text-rose-300" : metric.direction === "Mixto" ? "inline-grid size-8 place-items-center text-2xl font-black leading-none text-amber-300" : "inline-grid size-8 place-items-center text-2xl font-black leading-none text-zinc-500"} aria-label={`Dirección: ${metric.direction}`}>
              {metric.direction === "Sube" ? "↑" : metric.direction === "Baja" ? "↓" : metric.direction === "Mixto" ? "◆" : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
