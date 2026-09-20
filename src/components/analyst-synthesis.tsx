import type { AnalystSynthesis } from "@/lib/dashboard";

export function AnalystSynthesisPanel({ analysis }: { analysis: AnalystSynthesis }) {
  return (
    <section className="panel overflow-hidden" aria-labelledby="cloe-analysis-title">
      <div className="border-b border-border bg-cyan-400/[0.04] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="metric-label text-cyan-300">Síntesis experta</p>
            <h2 id="cloe-analysis-title" className="mt-1 text-lg font-semibold text-white">Cloe Analista</h2>
          </div>
          <span className={analysis.hasContent ? "badge badge-neutral" : "badge badge-warning"}>
            {analysis.hasContent ? "Último cruce guardado" : "Sin actualización analítica"}
          </span>
        </div>
        <p className="mt-3 max-w-5xl text-sm leading-6 text-zinc-200">
          {analysis.conclusion ?? "Todavía no hay una conclusión analítica consolidada. La ausencia de contenido no se completa con inferencias ni texto de demostración."}
        </p>
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-3">
        {analysis.modules.map((module) => (
          <article className="bg-panel px-4 py-4 sm:px-5" key={module.key}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{module.label}</h3>
              <span className={module.available ? "badge badge-neutral" : "badge badge-muted"}>
                {module.available ? "Disponible" : "Sin actualización"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {module.summary ?? `No hay una conclusión independiente de ${module.label} guardada en el último corte.`}
            </p>
            {module.signal ? (
              <p className="mt-3 border-l-2 border-cyan-400/40 pl-3 font-mono text-[11px] uppercase tracking-wide text-cyan-200">
                {module.signal}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="grid gap-4 border-t border-border px-4 py-4 sm:px-5 lg:grid-cols-2">
        <ReasoningList
          empty="No hay coincidencias documentadas en el último cruce."
          items={analysis.agreements}
          label="Coincidencias"
          tone="positive"
        />
        <ReasoningList
          empty="No hay contradicciones documentadas en el último cruce."
          items={analysis.contradictions}
          label="Contradicciones"
          tone="warning"
        />
      </div>
    </section>
  );
}

function ReasoningList({
  empty,
  items,
  label,
  tone,
}: {
  empty: string;
  items: string[];
  label: string;
  tone: "positive" | "warning";
}) {
  return (
    <div>
      <h3 className="metric-label">{label}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 grid gap-2">
          {items.map((item, index) => (
            <li className="flex gap-2 text-sm leading-6 text-zinc-300" key={`${label}-${index}`}>
              <span className={tone === "positive" ? "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" : "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">{empty}</p>
      )}
    </div>
  );
}
