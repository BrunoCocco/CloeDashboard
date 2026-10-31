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
    <section className={styles.archive} aria-label="Análisis e histórico">
      <form action="/" method="get" className={styles.filters}>
        <label>
          <span className={styles.srOnly}>Activo</span>
          <select name="asset" defaultValue={archive.asset ?? ""}>
            <option value="">Todos</option>
            {REVIEW_ASSETS.map((symbol) => (
              <option key={symbol}>{symbol}</option>
            ))}
          </select>
        </label>
        <button type="submit">Filtrar</button>
        {archive.selected?.isLatest === false ? (
          <Link prefetch={false} href="/">
            Último corte
          </Link>
        ) : null}
      </form>
      {archive.message ? (
        <p role="status" className={styles.warning}>
          {archive.message}
        </p>
      ) : null}
      {archive.status === "empty" ? (
        <p className={styles.notice}>Sin análisis para este filtro.</p>
      ) : null}
      {archive.selected ? (
        <AnalysisReviewDocument entry={archive.selected} />
      ) : null}
      {archive.items.length ? (
        <details className={styles.history}>
          <summary>Histórico</summary>
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
    </section>
  );
}
