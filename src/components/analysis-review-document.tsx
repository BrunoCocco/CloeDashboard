"use client";
import type { ReviewEntry } from "@/lib/analysis-reviews/model";
import styles from "./analysis-reviews.module.css";
export function AnalysisReviewDocument({ entry }: { entry: ReviewEntry }) {
  const s = entry.snapshot;
  const time = (value: string, zone: string) =>
    new Intl.DateTimeFormat("es-ES", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "cloe-analysis-review",
            version: 1,
            example: entry.example,
            record: {
              id: entry.id,
              analysisDate: entry.analysisDate,
              observedAt: entry.observedAt,
              createdAt: entry.createdAt,
              asset: entry.asset,
              revisionOf: entry.revisionOf,
            },
            snapshot: s,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
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
      {entry.example ? (
        <p className={styles.warning}>
          <strong>EJEMPLO DE PRUEBA · NO GUARDADO EN LA BASE DE DATOS.</strong>{" "}
          Transcripción técnica solicitada; no es el último análisis real ni una
          cotización viva.
        </p>
      ) : null}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {entry.example
              ? "Prueba técnica"
              : entry.isLatest === false
                ? "Corte histórico seleccionado"
                : "Último corte guardado"}{" "}
            · estándar {s.standardVersion}
          </p>
          <h3>{s.title}</h3>
          <p>
            {s.asset.exchange} · {s.asset.pair} · Mercado:{" "}
            {s.asset.market === "unknown"
              ? "no verificado"
              : s.asset.market === "derivative"
                ? "Derivado"
                : "Spot"}
          </p>
        </div>
        <button type="button" onClick={download}>
          Descargar corte JSON
        </button>
      </header>
      <dl className={styles.metadata}>
        <div>
          <dt>Día del análisis</dt>
          <dd>{entry.analysisDate}</dd>
        </div>
        <div>
          <dt>Hora observada del mercado</dt>
          <dd>
            {entry.observedAt
              ? `${time(entry.observedAt, "Europe/Madrid")} (Madrid)`
              : "No verificada"}
          </dd>
        </div>
        <div>
          <dt>Registro en DB (UTC)</dt>
          <dd>
            {entry.createdAt
              ? `${time(entry.createdAt, "UTC")} UTC`
              : "Sin registro: ejemplo de prueba"}
          </dd>
        </div>
      </dl>
      {entry.revisionOf ? (
        <p className={styles.notice}>
          Corrección acumulativa del corte {entry.revisionOf}. El original se
          conserva.
        </p>
      ) : null}
      <p className={styles.notice}>
        {s.interpretation[0] ?? "Sin interpretación documentada."}
      </p>
      <p className={styles.small}>
        Solo análisis técnico de captura. Hora atribuida al archivo:{" "}
        {s.source.captureTime ?? "desconocida"};{" "}
        {s.source.captureTimeBasis === "filename-derived"
          ? "inferida del nombre, no verificada como hora de mercado"
          : "ver procedencia"}
        . Cotización viva no verificada.
      </p>
      <details>
        <summary>Fuente, procedencia y alcance</summary>
        <section>
          <h4>Fuente y alcance</h4>
          <p>{s.source.description}</p>
          <p>
            Hora atribuida a captura: {s.source.captureTime ?? "desconocida"} ·{" "}
            {s.source.captureTimeBasis === "filename-derived"
              ? "derivada del nombre de archivo; no verifica la hora de mercado"
              : s.source.captureTimeBasis === "verified"
                ? "verificada en la fuente"
                : "origen horario no verificado"}
            .
          </p>
          <p>
            Fundamental y Fechas no pertenecen a este corte técnico. No se
            rellenan con esta captura.
          </p>
          {s.source.sha256 ? (
            <details>
              <summary>Huella de evidencia</summary>
              <code className={styles.hash}>{s.source.sha256}</code>
            </details>
          ) : null}
        </section>
      </details>
      <details>
        <summary>
          Datos y configuración por temporalidad · {s.facts.length} lecturas
        </summary>
        <section>
          <h4>1. Datos y lecturas de la captura</h4>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Marco</th>
                  <th>Dato</th>
                  <th>Lectura</th>
                  <th>Origen / configuración</th>
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
      </details>
      <details>
        <summary>Interpretación completa</summary>
        <section>
          <h4>2. Interpretación</h4>
          <List items={s.interpretation} />
        </section>
      </details>
      <section>
        <h4>3. Hipótesis · no predicciones confirmadas</h4>
        {s.hypotheses.map((h, i) => (
          <div className={styles.subpanel} key={i}>
            <p>{h.statement}</p>
            <p className={styles.small}>
              Evidencias: {h.evidenceIds.join(", ")}
            </p>
            <div className={styles.columns}>
              <div>
                <h5>Confirmaciones pendientes</h5>
                <List items={h.confirmation} />
              </div>
              <div>
                <h5>Invalidaciones</h5>
                <List items={h.invalidation} />
              </div>
            </div>
          </div>
        ))}
      </section>
      <section>
        <h4>4. Escenarios contrarios</h4>
        <div className={styles.columns}>
          {s.scenarios.map((scenario, i) => (
            <div className={styles.subpanel} key={i}>
              <h5>{scenario.name}</h5>
              <p>{scenario.reading}</p>
              <h5>Qué confirmaría</h5>
              <List items={scenario.confirmation} />
              <h5>Qué invalidaría</h5>
              <List items={scenario.invalidation} />
            </div>
          ))}
        </div>
      </section>
      <details>
        <summary>Limitaciones y datos pendientes</summary>
        <section>
          <h4>5. Limitaciones y datos pendientes</h4>
          <List items={s.limitations} />
        </section>
      </details>
      <details>
        <summary>Bibliografía y método</summary>
        <section>
          <h4>Bibliografía y método</h4>
          <p>
            Fuentes bibliográficas consultadas en este corte:{" "}
            {s.bibliography.consulted.length
              ? "ver lista"
              : "ninguna; no se atribuye una lectura que no se hizo"}
            .
          </p>
          <List items={s.bibliography.consulted} />
          <List items={s.bibliography.conceptual} />
          <p className={styles.notice}>
            Información insuficiente no se transforma en una orden ni en
            decisión automática. Los resultados futuros se registrarán como
            nuevos eventos, sin reescribir este corte.
          </p>
        </section>
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
