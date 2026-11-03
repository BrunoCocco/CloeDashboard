import type { MacroMetric } from "@/lib/dashboard";
const tones: Record<NonNullable<MacroMetric["tone"]>, string> = {
  "extreme-fear": "text-red-300",
  fear: "text-rose-300",
  neutral: "text-amber-200",
  greed: "text-emerald-300",
  "extreme-greed": "text-emerald-200",
  unavailable: "text-zinc-500",
};
export function MacroPanel({ metrics }: { metrics: MacroMetric[] }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Indicadores macro y mercado"
    >
      {metrics.map((metric) => (
        <article key={metric.name} className="panel min-w-0 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={`text-sm font-medium ${metric.tone ? tones[metric.tone] : "text-zinc-300"}`}
            >
              {metric.name}
            </h3>
            <span
              className="text-lg text-cyan-200"
              aria-label={`Dirección: ${metric.direction}`}
            >
              {metric.direction === "Sube"
                ? "↑"
                : metric.direction === "Baja"
                  ? "↓"
                  : metric.direction === "Estable"
                    ? "→"
                    : "—"}
            </span>
          </div>
          <p
            className={`mt-3 break-words font-mono text-xl font-semibold ${metric.tone ? tones[metric.tone] : "text-white"}`}
          >
            {metric.value}
          </p>
          {metric.delta ? (
            <p className="mt-2 text-xs text-zinc-400">{metric.delta}</p>
          ) : null}
          <p className="mt-3 text-xs text-zinc-400">
            {metric.observedAt
              ? `Observación · ${metric.observedAt}`
              : "Sin dato verificado"}
          </p>
          {metric.source ? (
            <details className="mt-2 text-xs text-zinc-500">
              <summary className="cursor-pointer">Fuente</summary>
              {metric.source.url ? (
                <a
                  className="mt-2 block break-words text-cyan-300"
                  href={metric.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {metric.source.name}
                </a>
              ) : (
                <p>{metric.source.name}</p>
              )}
            </details>
          ) : null}
        </article>
      ))}
    </div>
  );
}
