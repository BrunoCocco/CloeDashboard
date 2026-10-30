import Link from "next/link";
import type { ReviewArchive } from "@/lib/analysis-reviews/model";
import { REVIEW_ASSETS } from "@/lib/analysis-reviews/model";
import { AnalysisReviewDocument } from "./analysis-review-document";
import styles from "./analysis-reviews.module.css";
export function AnalysisReviewArchive({ archive }: { archive: ReviewArchive }) {
  const link = (cut?: string, before?: string) => {
    const p = new URLSearchParams();
    if (archive.asset) p.set("asset", archive.asset);
    if (cut) p.set("cut", cut);
    if (before) p.set("before", before);
    return `/?${p}`;
  };
  return (
    <section className={styles.archive} aria-labelledby="review-archive-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Archivo analítico · base propia CloeDashboard
          </p>
          <h2 id="review-archive-title">Último análisis e histórico</h2>
        </div>
        <Link prefetch={false} href="/analisis/ejemplo">
          Ver prueba BTC separada
        </Link>
      </header>
      <p>
        Orden: día de análisis descendente y, dentro del día, registro
        descendente. La hora observada se muestra aparte; una hora de archivo no
        se trata como hora de mercado.
      </p>
      <form action="/" method="get" className={styles.filters}>
        <label>
          Activo
          <select name="asset" defaultValue={archive.asset ?? ""}>
            <option value="">Todos</option>
            {REVIEW_ASSETS.map((symbol) => (
              <option key={symbol}>{symbol}</option>
            ))}
          </select>
        </label>
        <button type="submit">Filtrar</button>
        <Link prefetch={false} href="/">
          Volver al último corte
        </Link>
      </form>
      {archive.message ? (
        <p role="status" className={styles.warning}>
          {archive.message}
        </p>
      ) : null}
      {archive.status === "empty" ? (
        <p className={styles.notice}>
          Sin actualización: no hay cortes guardados para este filtro. El
          ejemplo BTC está separado y no ocupa el histórico real.
        </p>
      ) : null}
      {archive.items.length ? (
        <details open className={styles.history}>
          <summary>Seleccionar corte · hasta 20 por página</summary>
          <ul>
            {archive.items.map((item) => (
              <li key={item.id}>
                <Link
                  prefetch={false}
                  href={link(item.id)}
                  aria-current={
                    archive.selected?.id === item.id ? "page" : undefined
                  }
                >
                  {item.analysisDate} · {item.asset} · registrado{" "}
                  {item.createdAt}
                  {item.revisionOf ? " · corrección" : ""}
                </Link>
              </li>
            ))}
          </ul>
          {archive.nextCursor ? (
            <Link prefetch={false} href={link(undefined, archive.nextCursor)}>
              Cortes anteriores →
            </Link>
          ) : null}
        </details>
      ) : null}
      {archive.selected ? (
        <AnalysisReviewDocument entry={archive.selected} />
      ) : null}
    </section>
  );
}
