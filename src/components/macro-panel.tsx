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
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5" key={metric.name}>
            <div><p className="text-xs font-medium text-zinc-200">{metric.name}</p><p className="mt-0.5 text-[10px] text-muted">{metric.note}</p></div>
            <span className="font-mono text-xs text-zinc-300">{metric.value}</span>
            <span className={metric.direction === "Sube" ? "text-emerald-300" : metric.direction === "Baja" ? "text-rose-300" : metric.direction === "Mixto" ? "text-amber-300" : "text-zinc-500"} aria-label={`Dirección: ${metric.direction}`}>
              {metric.direction === "Sube" ? "↑" : metric.direction === "Baja" ? "↓" : metric.direction === "Mixto" ? "◆" : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
