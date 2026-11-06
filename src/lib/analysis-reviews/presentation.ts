/** Display legacy compact text without changing the stored analysis. */
export function readableReviewText(value: string): string {
  return value
    .replace(/([a-záéíóúñ])(?=\d)/gi, "$1 ")
    .replace(/(\d)(?=[a-záéíóúñ])/g, "$1 ")
    // Only separate a timeframe after a number, never initials in author names.
    .replace(/(\d\s*[HDW])(?=[a-záéíóúñ])/g, "$1 ")
    .replace(/([,;:])(?=[a-záéíóúñ])/gi, "$1 ");
}
