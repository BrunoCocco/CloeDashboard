"use client";
import type { ReviewEntry } from "@/lib/analysis-reviews/model";
import { reviewExport } from "@/lib/analysis-reviews/export";
import styles from "./analysis-reviews.module.css";
export function AnalysisReviewDocument({ entry }: { entry: ReviewEntry }) {
  const s = entry.snapshot;
  const capturedPrice =
    s.source.kind === "capture-transcription"
      ? s.facts.find(
          (f) =>
            f.id === "price" &&
            f.origin === "visible" &&
            typeof f.value === "number" &&
            Number.isFinite(f.value) &&
            f.unit === s.asset.unit,
        )
      : undefined;
  const formatValue = (value: number | string | null) => typeof value === "number" ? value.toLocaleString("es-ES", { maximumFractionDigits: Math.abs(value) >= 1 ? 2 : 4 }) : value;
  const facts = s.facts.filter(f => f.value !== null && f.timeframe !== "unknown" && !["d-prior", "h-prior"].includes(f.id));
  const summary = s.scenarios.slice(0, 2).map(scenario => scenario.reading).join(" ") || "Escenario pendiente de datos suficientes.";
  function download() {
    const blob = new Blob([JSON.stringify(reviewExport(entry), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
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
                : "Corte activo"}{" "}
            · {entry.analysisDate}
          </p>
          <h3>
            {s.asset.pair}{" · "}
            <span className={styles.market}>{s.asset.exchange}</span>
          </h3>
          {capturedPrice ? (
            <p className={styles.capturePrice}>
              <span>En captura</span>{" "}
              {Number(capturedPrice.value).toLocaleString("es-ES", {
                maximumFractionDigits: 2,
              })}{" "}
              {capturedPrice.unit}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={download}>
          Exportar
        </button>
      </header>
      <p className={styles.synthesis}><strong>Escenario: </strong>{summary}</p>
      <details className={styles.fullDetails}>
        <summary>Análisis completo</summary>
        <div className={styles.fullContent}>
          <section>
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
                      <td>
                        {f.timeframe === "unknown"
                          ? "Sin atribución confirmada"
                          : f.timeframe}
                      </td>
                      <td>{f.label}{f.origin === "estimated" ? " (aprox.)" : ""}{f.id === "w-rsi" && s.limitations.some(l => /RSI.*(?:reconciliado|reconciliar)/i.test(l)) ? " · sin reconciliar" : ""}</td>
                      <td>
                        {f.value === null
                          ? "No disponible"
                          : `${formatValue(f.value)}${f.unit ? ` ${f.unit}` : ""}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h4>Interpretación</h4>
            <List items={s.interpretation} />
          </section>
        </div>
      </details>
    </article>
  );
}
function List({ items }: { items: string[] }) {
  return items.length ? (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : (
    <p>Sin información documentada.</p>
  );
}
