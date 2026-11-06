"use client";
import type { ReviewEntry } from "@/lib/analysis-reviews/model";
import { reviewExport } from "@/lib/analysis-reviews/export";
import { readableReviewText as readable } from "@/lib/analysis-reviews/presentation";
import styles from "./analysis-reviews.module.css";
const number = (value: number) =>
  value.toLocaleString("es-ES", {
    maximumFractionDigits: Math.abs(value) >= 1 ? 2 : 4,
  });
export function AnalysisReviewDocument({
  entry,
  previous = null,
}: {
  entry: ReviewEntry;
  previous?: ReviewEntry | null;
}) {
  const s = entry.snapshot;
  const facts = s.facts.filter(
    (f) => f.value !== null && f.timeframe !== "unknown",
  );
  const price = s.facts.find(
    (f) =>
      f.id === "price" &&
      typeof f.value === "number" &&
      f.unit === s.asset.unit,
  );
  const priorPrice = previous?.snapshot.facts.find(
    (f) =>
      f.id === "price" &&
      typeof f.value === "number" &&
      f.unit === s.asset.unit,
  );
  const comparable =
    previous &&
    previous.asset === entry.asset &&
    previous.snapshot.asset.pair === s.asset.pair &&
    previous.snapshot.asset.exchange === s.asset.exchange &&
    previous.snapshot.asset.market === s.asset.market;
  const delta =
    comparable && price && priorPrice
      ? Number(price.value) - Number(priorPrice.value)
      : null;
  const levels = facts
    .filter(
      (f) =>
        typeof f.value === "number" &&
        f.unit === s.asset.unit &&
        /support|resistance|near|lower|upper|^low$|^high$/.test(f.id) &&
        !/bb|vwap/.test(f.id),
    )
    .sort((a, b) => Number(a.value) - Number(b.value))
    .slice(0, 3);
  const headline =
    s.title.split(" · ").slice(1).join(" · ") || "Lectura del mercado";
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(reviewExport(entry), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `cloe-${entry.example ? "ejemplo-" : ""}${entry.asset}-${entry.analysisDate}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <article
      className={styles.document}
      aria-label="Documento de análisis del corte"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {entry.example
              ? "Ejemplo · no guardado"
              : entry.isLatest === false
                ? "Corte histórico"
                : "Último análisis"}{" "}
            · {entry.analysisDate}
          </p>
          <h2>
            <span className={styles.coin}>{entry.asset.slice(0, 1)}</span>
            {s.asset.pair}
            <span className={styles.market}>
              {s.asset.exchange} ·{" "}
              {s.asset.market === "spot"
                ? "Spot"
                : s.asset.market === "derivative"
                  ? "Derivado"
                  : "Mercado sin verificar"}
            </span>
          </h2>
        </div>
        <button type="button" onClick={download}>
          ↓ Exportar
        </button>
      </header>
      <div className={styles.analysisGrid}>
        <div className={styles.mainPanel}>
          <div className={styles.heroTop}>
            <div>
              <p className={styles.kicker}>ESCENARIO ACTUAL</p>
              <h3>{headline}</h3>
            </div>
            {price ? (
              <div className={styles.price}>
                <strong>
                  {number(Number(price.value))}
                  <small> {s.asset.unit}</small>
                </strong>
                <span>Precio del corte · no en vivo</span>
              </div>
            ) : null}
          </div>
          <p className={styles.synthesis}>
            {s.interpretation[0] ??
              "Información insuficiente para una lectura."}
          </p>
          {levels.length ? (
            <div
              className={styles.levelRail}
              aria-label="Referencias del análisis"
            >
              {levels.map((f) => (
                <div key={f.id}>
                  <span className={styles.node} />
                  <strong>{number(Number(f.value))}</strong>
                  <small>{readable(f.label)}</small>
                </div>
              ))}
            </div>
          ) : null}
          <div className={styles.scenarios}>
            {s.scenarios.slice(0, 2).map((scenario, i) => (
              <section
                className={`${styles.scenarioCard} ${i === 0 ? styles.recovery : styles.decline}`}
                key={scenario.name}
              >
                <p className={styles.scenarioIcon} aria-hidden="true">
                  {i === 0 ? "↗" : "↘"}
                </p>
                <h4>{scenario.name}</h4>
                <p>{readable(scenario.reading)}</p>
                <details className={styles.conditions}>
                  <summary>Qué lo confirma</summary>
                  <ul>
                    {scenario.confirmation.map((v, j) => (
                      <li key={j}>{readable(v)}</li>
                    ))}
                  </ul>
                  <strong>Qué lo invalida</strong>
                  <ul>
                    {scenario.invalidation.map((v, j) => (
                      <li key={j}>{readable(v)}</li>
                    ))}
                  </ul>
                </details>
              </section>
            ))}
          </div>
          <details className={styles.fullDetails}>
            <summary>Ver interpretación completa</summary>
            <div className={styles.fullContent}>
              {s.interpretation.slice(1).map((p, i) => (
                <p key={i}>{readable(p)}</p>
              ))}
              <h4>Niveles e indicadores</h4>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Marco</th>
                      <th>Dato</th>
                      <th>Lectura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facts.map((f) => (
                      <tr key={f.id}>
                        <td>{f.timeframe}</td>
                        <td>
                          {f.label}
                          {f.origin === "estimated" ? " · aprox." : ""}
                          {f.id === "w-rsi" &&
                          s.limitations.some((l) =>
                            /RSI.*(?:reconciliado|reconciliar)/i.test(l),
                          )
                            ? " · sin reconciliar"
                            : ""}
                        </td>
                        <td>
                          {typeof f.value === "number"
                            ? number(f.value)
                            : f.value}{" "}
                          {f.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </div>
        <aside className={styles.sideColumn}>
          <section className={styles.sidePanel}>
            <h3>Qué cambió</h3>
            {previous ? (
              <>
                <p className={styles.muted}>
                  Frente al corte del {previous.analysisDate}
                </p>
                {delta !== null ? (
                  <div className={styles.change}>
                    <span>Precio entre cortes</span>
                    <strong>
                      {delta > 0 ? "+" : ""}
                      {number(delta)} {s.asset.unit}
                    </strong>
                  </div>
                ) : (
                  <p>Precios no comparables.</p>
                )}
                <p className={styles.finePrint}>
                  Diferencia entre lecturas; no variación de 24 horas.
                </p>
                <a href={`/?asset=${entry.asset}&cut=${previous.id}`}>
                  Consultar corte anterior ↗
                </a>
              </>
            ) : (
              <p className={styles.muted}>
                Sin corte previo comparable disponible.
              </p>
            )}
          </section>
          <section className={styles.sidePanel}>
            <h3>Lectura por marco</h3>
            {(
              [
                ["1W", "Semanal"],
                ["1D", "Diario"],
                ["4H", "4 horas"],
                ["1H", "1 hora"],
              ] as const
            )
              .filter(([tf]) => facts.some((f) => f.timeframe === tf))
              .map(([tf, label]) => {
                const readings = facts
                  .filter(
                    (f) =>
                      f.timeframe === tf && /rsi|ma|bb-mid|vwap/.test(f.id),
                  )
                  .slice(0, 2);
                return (
                  <div className={styles.frame} key={tf}>
                    <strong>{label}</strong>
                    <span>
                      {readings.length
                        ? readings
                            .map(
                              (f) =>
                                `${f.label}: ${typeof f.value === "number" ? number(f.value) : f.value}`,
                            )
                            .join(" · ")
                        : "Ver niveles en el detalle"}
                    </span>
                  </div>
                );
              })}
            <p className={styles.finePrint}>
              Lecturas del corte. No se asigna un sesgo automático.
            </p>
          </section>
        </aside>
      </div>
    </article>
  );
}
