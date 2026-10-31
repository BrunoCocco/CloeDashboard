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
  const time = (value: string, zone: string) =>
    new Intl.DateTimeFormat("es-ES", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
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
            {s.asset.pair}
            <span className={styles.market}>{s.asset.exchange}</span>
          </h3>
          {capturedPrice ? (
            <p className={styles.capturePrice}>
              <span>En captura</span>{" "}
              {Number(capturedPrice.value).toLocaleString("es-ES", {
                maximumFractionDigits: 8,
              })}{" "}
              {capturedPrice.unit}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={download}>
          Exportar
        </button>
      </header>
      <p className={styles.sourceLine}>
        {entry.observedAt
          ? `${time(entry.observedAt, "Europe/Madrid")} · Madrid`
          : `${s.source.kind === "capture-transcription" ? "Captura" : "Fuente"} · hora de mercado no verificada`}
      </p>
      <p className={styles.synthesis}><strong>Escenario: </strong>{summary}</p>
      <details className={styles.fullDetails}>
        <summary>Análisis completo</summary>
        <div className={styles.fullContent}>
          <section>
            <h4>Datos y configuración</h4>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Marco</th>
                    <th>Dato</th>
                    <th>Lectura</th>
                    <th>Procedencia / configuración</th>
                  </tr>
                </thead>
                <tbody>
                  {s.facts.map((f) => (
                    <tr key={f.id}>
                      <td>
                        {f.timeframe === "unknown"
                          ? "Sin atribución confirmada"
                          : f.timeframe}
                      </td>
                      <td>{f.label}</td>
                      <td>
                        {f.value === null
                          ? "No disponible"
                          : `${f.value}${f.unit ? ` ${f.unit}` : ""}`}
                      </td>
                      <td>
                        {f.origin === "visible"
                          ? "Transcripción visible"
                          : f.origin === "estimated"
                            ? "Estimación"
                            : "Desconocido"}
                        {f.configuration ? <p>{f.configuration}</p> : null}
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
          <section>
            <h4>Hipótesis</h4>
            {s.hypotheses.map((h, i) => (
              <div key={i}>
                <p>{h.statement}</p>
                <h5>Confirmaciones pendientes</h5>
                <List items={h.confirmation} />
                <h5>Invalidaciones</h5>
                <List items={h.invalidation} />
              </div>
            ))}
          </section>
          <section>
            <h4>Escenarios · requisitos</h4>
            {s.scenarios.map((scenario, i) => (
              <div key={i}>
                <h5>{scenario.name}</h5>
                <p>{scenario.reading}</p>
                <h5>Confirmación</h5>
                <List items={scenario.confirmation} />
                <h5>Invalidación</h5>
                <List items={scenario.invalidation} />
              </div>
            ))}
          </section>
          <section>
            <h4>Limitaciones</h4>
            <List items={s.limitations} />
          </section>
          <section>
            <h4>Bibliografía y método</h4>
            <p>
              Consultada en este corte:{" "}
              {s.bibliography.consulted.length ? "ver lista" : "ninguna"}.
            </p>
            {s.bibliography.consulted.length ? (
              <List items={s.bibliography.consulted} />
            ) : null}
            <List items={s.bibliography.conceptual} />
            <p>
              Los resultados posteriores se registran sin reescribir el corte.
              No se generan decisiones automáticas.
            </p>
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
