import { z } from "zod";
const basis = {
  unit: z.string().max(80).nullable(),
  origin: z.enum(["visible", "estimated", "unreadable"]),
  confidence: z.enum(["high", "medium", "low"]).nullable(),
  rationale: z.string().max(1200),
  visibleEvidence: z.string().max(1200).nullable(),
};
const textField = z
  .object({ value: z.string().max(500).nullable(), ...basis })
  .strict();
const numberField = z
  .object({ value: z.number().finite().nullable(), ...basis })
  .strict();
const scalarField = z
  .object({
    value: z
      .union([z.string().max(500), z.number().finite(), z.boolean()])
      .nullable(),
    ...basis,
  })
  .strict();
export const widgetReadingSchema = z
  .object({
    schemaVersion: z.literal(1),
    panels: z
      .array(
        z
          .object({
            position: z.enum(["top", "middle", "bottom", "single"]),
            asset: textField,
            exchange: textField,
            pair: textField,
            timeframe: textField,
            candleReference: textField,
            displayedPrice: numberField,
            ohlc: z
              .object({
                open: numberField,
                high: numberField,
                low: numberField,
                close: numberField,
              })
              .strict(),
            volume: numberField,
            indicators: z
              .array(
                z
                  .object({
                    name: textField,
                    params: z
                      .array(
                        z
                          .object({
                            name: z.string().min(1).max(80),
                            reading: scalarField,
                          })
                          .strict(),
                      )
                      .max(30),
                    values: z
                      .array(
                        z
                          .object({
                            label: z.string().min(1).max(120),
                            reading: scalarField,
                          })
                          .strict(),
                      )
                      .max(30),
                  })
                  .strict(),
              )
              .max(20),
            marks: z
              .array(
                z
                  .object({
                    kind: z.string().min(1).max(120),
                    geometry: z.enum([
                      "point",
                      "range",
                      "line",
                      "zone",
                      "unknown",
                    ]),
                    prices: z.array(numberField).max(4),
                    times: z.array(textField).max(4),
                    description: z.string().max(1200),
                    confidence: z.enum(["high", "medium", "low"]),
                    rationale: z.string().min(1).max(1200),
                    visibleEvidence: z.string().min(1).max(1200),
                  })
                  .strict(),
              )
              .max(50),
            limitations: z.array(z.string().max(1200)).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    limitations: z.array(z.string().max(1200)).max(30),
  })
  .strict();
export type WidgetReading = z.infer<typeof widgetReadingSchema>;
export type ReadingField = z.infer<typeof scalarField>;
export type WidgetReadingBundle = {
  data: WidgetReading;
  method: "vision" | "imported" | "edited";
  processedAt: string;
  model: string | null;
};
function checkField(field: ReadingField) {
  if (
    field.value === null &&
    (field.origin !== "unreadable" || field.confidence !== null)
  )
    throw new Error(
      "Un valor desconocido debe ser null, origen unreadable y confianza null.",
    );
  if (
    field.value !== null &&
    (field.origin === "unreadable" ||
      !field.confidence ||
      !field.rationale.trim() ||
      !field.visibleEvidence?.trim())
  )
    throw new Error(
      "Cada valor leído o estimado necesita origen, confianza, motivo y evidencia visible.",
    );
}
export function parseWidgetReading(value: unknown): WidgetReading {
  const result = widgetReadingSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      "JSON de lectura inválido: revisá el contrato de paneles, campos, indicadores y marcas.",
    );
  for (const panel of result.data.panels) {
    for (const field of [
      panel.asset,
      panel.exchange,
      panel.pair,
      panel.timeframe,
      panel.candleReference,
      panel.displayedPrice,
      ...Object.values(panel.ohlc),
      panel.volume,
    ])
      checkField(field);
    for (const indicator of panel.indicators) {
      checkField(indicator.name);
      for (const param of indicator.params) checkField(param.reading);
      for (const item of indicator.values) checkField(item.reading);
    }
    for (const mark of panel.marks)
      for (const field of [...mark.prices, ...mark.times]) checkField(field);
  }
  return result.data;
}
export function importWidgetReading(json: string): WidgetReadingBundle {
  if (json.length > 300000)
    throw new Error("Lectura demasiado grande; máximo 300000 caracteres.");
  return {
    data: parseWidgetReading(JSON.parse(json)),
    method: "imported",
    processedAt: new Date().toISOString(),
    model: null,
  };
}
export function flattenWidgetReading(data: WidgetReading) {
  const rows: { panel: string; field: string; reading: ReadingField }[] = [];
  data.panels.forEach((panel, index) => {
    const id = `${index + 1}:${panel.position}`;
    const push = (field: string, reading: ReadingField) =>
      rows.push({ panel: id, field, reading });
    for (const key of [
      "asset",
      "exchange",
      "pair",
      "timeframe",
      "candleReference",
      "displayedPrice",
      "volume",
    ] as const)
      push(key, panel[key]);
    for (const [key, field] of Object.entries(panel.ohlc))
      push(`ohlc.${key}`, field);
    panel.indicators.forEach((indicator, i) => {
      const prefix = `indicator[${i + 1}]`;
      push(`${prefix}.name`, indicator.name);
      for (const param of indicator.params)
        push(`${prefix}.param.${param.name}`, param.reading);
      indicator.values.forEach((item, j) =>
        push(`${prefix}.value[${j + 1}].${item.label}`, item.reading),
      );
    });
    panel.marks.forEach((mark, i) => {
      const prefix = `mark[${i + 1}].${mark.kind}.${mark.geometry}`;
      push(`${prefix}.description`, {
        value: mark.description,
        unit: null,
        origin: "estimated",
        confidence: mark.confidence,
        rationale: mark.rationale,
        visibleEvidence: mark.visibleEvidence,
      });
      mark.prices.forEach((field, j) =>
        push(`${prefix}.price[${j + 1}]`, field),
      );
      mark.times.forEach((field, j) => push(`${prefix}.time[${j + 1}]`, field));
    });
    panel.limitations.forEach((value, i) =>
      push(`limitation[${i + 1}]`, {
        value,
        unit: null,
        origin: "unreadable",
        confidence: null,
        rationale: "Límite de lectura",
        visibleEvidence: null,
      }),
    );
  });
  data.limitations.forEach((value, i) =>
    rows.push({
      panel: "capture",
      field: `limitation[${i + 1}]`,
      reading: {
        value,
        unit: null,
        origin: "unreadable",
        confidence: null,
        rationale: "Límite de lectura",
        visibleEvidence: null,
      },
    }),
  );
  return rows;
}
function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function widgetReadingCsv(data: WidgetReading): string {
  const rows: unknown[][] = [
    [
      "panel",
      "field",
      "value",
      "value_type",
      "unit",
      "origin",
      "confidence",
      "rationale",
      "visible_evidence",
    ],
  ];
  for (const { panel, field, reading } of flattenWidgetReading(data))
    rows.push([
      panel,
      field,
      reading.value,
      reading.value === null ? "null" : typeof reading.value,
      reading.unit,
      reading.origin,
      reading.confidence,
      reading.rationale,
      reading.visibleEvidence,
    ]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
