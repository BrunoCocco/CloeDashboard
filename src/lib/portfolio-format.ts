export function formatMoney(value: number | null, currency: string) {
  if (value === null) return "Sin cotización";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
