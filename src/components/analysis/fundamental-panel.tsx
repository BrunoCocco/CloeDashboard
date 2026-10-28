import type {
  AssetFundamental,
  FundamentalSource,
} from "@/lib/analysis/fundamentals";
import type { SymbolCode } from "@/lib/analysis/model";
const regimes = {
  favorable: "Favorable",
  neutral: "Neutral",
  negative: "Negativo",
  insufficient_data: "Información insuficiente",
};
function Source({ value }: { value: FundamentalSource }) {
  return value.url ? (
    <a
      className="text-cyan-300 hover:underline"
      href={value.url}
      target="_blank"
      rel="noreferrer"
    >
      {value.name} ↗
    </a>
  ) : (
    <span>{value.name}</span>
  );
}
function showDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}
export function AssetFundamentalPanel({
  symbol,
  analysis,
}: {
  symbol: SymbolCode;
  analysis: AssetFundamental;
}) {
  return (
    <section
      className="panel mb-4 p-4 sm:p-5"
      aria-label={`Fundamental de ${symbol}`}
      data-fundamental-symbol={symbol}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">
            Fundamental del activo seleccionado
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {symbol} · Tesis y fundamentos
          </h2>
        </div>
        <span
          className={
            analysis.status === "available"
              ? "badge badge-neutral"
              : "badge badge-warning"
          }
        >
          {analysis.status === "available"
            ? "Último análisis guardado"
            : analysis.status === "unavailable"
              ? "Consulta no disponible"
              : "Sin análisis específico"}
        </span>
      </div>
      {analysis.status === "available" ? (
        <>
          <p className="mt-3 text-sm leading-6 text-zinc-200">
            {analysis.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <span>
              {analysis.asOf
                ? `${analysis.cutoffOrigin === "asset" ? "Corte del activo" : "Corte del registro"}: ${showDate(analysis.asOf)} Madrid`
                : "Corte no informado"}
            </span>
            <span>
              Régimen:{" "}
              {analysis.regime
                ? regimes[analysis.regime]
                : "No informado para este activo"}
            </span>
            <span>
              Confianza:{" "}
              {analysis.confidence !== null
                ? `${analysis.confidence}% (declarada en el análisis)`
                : "No informada para este activo"}
            </span>
          </div>
          {analysis.hypothesis ? (
            <p className="mt-4 rounded-lg border border-border bg-surface/50 p-3 text-sm leading-6">
              <strong className="text-cyan-200">
                Hipótesis del analista:{" "}
              </strong>
              {analysis.hypothesis}
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <h3 className="metric-label">Evidencias</h3>
              {analysis.evidence.length ? (
                <ul className="mt-2 grid gap-2 text-sm leading-6 text-zinc-300">
                  {analysis.evidence.map((item, index) => (
                    <li key={index} className="rounded-lg bg-surface/50 p-3">
                      <p>{item.text}</p>
                      {item.source || item.observedAt ? (
                        <p className="mt-1 text-xs text-muted">
                          {item.source ? <Source value={item.source} /> : null}
                          {item.observedAt
                            ? ` · Observado: ${showDate(item.observedAt)} Madrid`
                            : ""}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted">
                          Fuente y fecha de evidencia no informadas.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Sin evidencia detallada cargada para {symbol}.
                </p>
              )}
            </div>
            <div>
              <h3 className="metric-label">Riesgos específicos</h3>
              {analysis.risks.length ? (
                <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-6 text-zinc-300">
                  {analysis.risks.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Sin riesgos específicos documentados.
                </p>
              )}
            </div>
            <div>
              <h3 className="metric-label">Oportunidades documentadas</h3>
              {analysis.opportunities.length ? (
                <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-6 text-zinc-300">
                  {analysis.opportunities.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Sin oportunidades específicas documentadas.
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3 text-xs text-muted">
            Fuentes del análisis:{" "}
            {analysis.sources.length
              ? analysis.sources.map((value, index) => (
                  <span className="mr-4 inline-block" key={index}>
                    <Source value={value} />
                  </span>
                ))
              : "No informadas."}
            <p className="mt-2">
              Corte histórico disponible; no implica actualización en tiempo
              real. La información general del mercado se consulta por separado.
            </p>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">
          {analysis.status === "unavailable"
            ? `No se pudo consultar el fundamental privado de ${symbol}. No se sustituyó por un análisis de otro activo o del mercado general.`
            : `Todavía no hay un análisis fundamental etiquetado específicamente para ${symbol}. El contexto macro general permanece en DATOS MERCADO; no se presenta como una tesis de este activo.`}
        </p>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="metric-label">
          Noticias verificadas vinculadas a {symbol}
        </h3>
        {analysis.news.length ? (
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {analysis.news.map((item, index) => (
              <li className="rounded-lg bg-surface/50 p-3" key={index}>
                <p className="text-sm font-medium">{item.title}</p>
                {item.summary ? (
                  <p className="mt-2 text-xs leading-5 text-zinc-300">
                    {item.summary}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted">
                  {item.verification === "official"
                    ? "Fuente oficial"
                    : "Corroborada"}{" "}
                  ·{" "}
                  {item.publishedAt
                    ? `${showDate(item.publishedAt)} Madrid`
                    : "Publicación sin fecha informada"}
                </p>
                <p className="mt-1 text-xs">
                  {item.source ? (
                    <Source value={item.source} />
                  ) : (
                    "Fuente no informada"
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">
            {analysis.newsStatus === "unavailable"
              ? "No se pudieron consultar las noticias privadas de este activo."
              : "Sin noticias verificadas cargadas para este activo."}
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted">
          Hasta tres registros del histórico propio; cobertura no exhaustiva.
          Una noticia no constituye una tesis ni una recomendación.
        </p>
      </div>
    </section>
  );
}
