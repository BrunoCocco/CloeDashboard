import type { ReviewEntry } from "./model";
/** Export the stored cut, never the shortened presentation. */
export function reviewExport(entry: ReviewEntry) {
  return {
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
    snapshot: entry.snapshot,
  };
}
