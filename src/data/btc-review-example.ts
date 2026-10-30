import {
  parseReviewSnapshot,
  type ReviewEntry,
} from "@/lib/analysis-reviews/model";
// Authorized transcription example. No private image, library identifier or owner is stored here.
const fact = (
  id: string,
  timeframe: "1W" | "1D" | "4H" | "unknown",
  label: string,
  value: number | string | null,
  unit: string | null,
  configuration: string | null = null,
) => ({
  id,
  timeframe,
  label,
  value,
  unit,
  configuration,
  origin: value === null ? "unknown" : "visible",
});
export const btcReviewExample: ReviewEntry = {
  id: "example-btc-2026-10-30",
  analysisDate: "2026-10-30",
  observedAt: null,
  createdAt: null,
  asset: "BTC",
  revisionOf: null,
  example: true,
  snapshot: parseReviewSnapshot({
    version: 1,
    standardVersion: "1.0",
    title: "BTCUSD · revisión de captura semanal, diaria y 4H",
    analysisDate: "2026-10-30",
    asset: {
      symbol: "BTC",
      pair: "BTCUSD",
      exchange: "Binance",
      market: "unknown",
      unit: "USD",
    },
    source: {
      kind: "capture-transcription",
      description:
        "Transcripción de una captura aportada para esta prueba. No es una consulta de mercado en vivo.",
      captureTime: "2026-10-30T15:34:45.539Z",
      captureTimeBasis: "filename-derived",
      observedAt: null,
      sha256:
        "fb7e0bc75ef88ce056ee85e1f5486ddab9972ed924bb2056b3a5c729898599e7",
    },
    facts: [
      fact(
        "price",
        "unknown",
        "Precio mostrado",
        77423.97,
        "USD",
        "No se verificó timestamp de mercado ni vela bajo cursor",
      ),
      fact("w-upper", "1W", "Línea horizontal superior", 101417.44, "USD"),
      fact("w-lower", "1W", "Línea horizontal inferior", 72563.34, "USD"),
      fact(
        "w-vwap",
        "1W",
        "VWAP",
        74672.24,
        "USD",
        "Anclaje Year (anual); fuente y demás parámetros no verificados",
      ),
      fact(
        "w-rsi",
        "1W",
        "RSI",
        51.21,
        "puntos",
        "Período y fuente no verificados",
      ),
      fact(
        "w-smooth",
        "1W",
        "Suavizado de RSI",
        53.26,
        "puntos",
        "Método y período no verificados",
      ),
      fact(
        "d-ma",
        "1D",
        "Media móvil",
        81388.56,
        "USD",
        "MA21; tipo y fuente no verificados",
      ),
      fact(
        "d-rsi",
        "1D",
        "RSI",
        35.13,
        "puntos",
        "Período y fuente no verificados",
      ),
      fact("rect-one", "unknown", "Amplitud de rectángulo previo", -8.16, "%"),
      fact("rect-two", "unknown", "Amplitud de otro rectángulo", -7.41, "%"),
      fact(
        "projection",
        "unknown",
        "Rectángulo de proyección dibujado",
        -8.41,
        "%",
        "Dibujo del analista; no pronóstico confirmado",
      ),
      fact(
        "bb-mid",
        "4H",
        "Bollinger: media",
        79798.28,
        "USD",
        "Período 20; desviación 2; fuente no verificada",
      ),
      fact(
        "bb-upper",
        "4H",
        "Bollinger: banda superior",
        82789.34,
        "USD",
        "Período 20; desviación 2",
      ),
      fact(
        "bb-lower",
        "4H",
        "Bollinger: banda inferior",
        76807.22,
        "USD",
        "Período 20; desviación 2",
      ),
      fact("volume", "4H", "Serie de volumen confirmatoria", null, null),
    ],
    interpretation: [
      "El precio mostrado está bajo MA21 diaria y media Bollinger de 4H, cerca de la banda inferior de 4H. Es una relación de niveles de esta captura; no demuestra el recorrido posterior.",
      "RSI diario de 35.13 refleja debilidad relativa en la lectura mostrada. No confirma sobreventa convencional ni divergencia; el semanal de 51.21 no coincide con una lectura diaria extrema.",
      "Las amplitudes dibujadas del 7–8% son comparables como observación gráfica. La similitud no convierte el rectángulo proyectado en predicción.",
    ],
    hypotheses: [
      {
        statement:
          "Podría repetirse una corrección de amplitud aproximada del 7–8%; es una hipótesis pendiente de estructura y volumen.",
        evidenceIds: ["rect-one", "rect-two", "projection", "volume"],
        confirmation: [
          "Secuencia de estructura y cierres coherente en 4H/diario, con volumen verificado; no disponible en esta captura.",
        ],
        invalidation: [
          "Recuperación sostenida de la zona de 79.800–81.400 USD con estructura contraria a la continuación correctiva.",
        ],
      },
    ],
    scenarios: [
      {
        name: "Recuperación",
        reading:
          "Revisar recuperación de 79.800 y 81.400 USD (medias de 4H y diaria de la captura).",
        confirmation: [
          "Aceptación mediante cierres y estructura, contrastada con serie y volumen actualizados.",
        ],
        invalidation: [
          "Rechazo de esas zonas y nueva pérdida de estructura; exige verificación posterior.",
        ],
      },
      {
        name: "Continuación correctiva",
        reading:
          "Revisar respuesta en 74.000–75.000 USD y en la línea de 72.563,34 USD, sin asumir que el precio vaya a alcanzarlas.",
        confirmation: [
          "Pérdida sostenida de soportes/estructura con volumen verificable; faltan esos datos.",
        ],
        invalidation: [
          "Recuperación estructural sostenida de 79.800–81.400 USD.",
        ],
      },
    ],
    limitations: [
      "Hora de captura inferida exclusivamente del nombre del archivo; no verifica la hora de mercado.",
      "Sin serie OHLCV completa, sin confirmación de cierres y sin actualización de cotización.",
      "No se confirma fase Wyckoff, divergencia RSI ni sobreventa convencional.",
      "Par/exchange transcritos; modalidad spot/derivado no verificada.",
      "Fundamental y Fechas no se completan con esta captura técnica; permanecen independientes.",
    ],
    bibliography: {
      consulted: [],
      conceptual: [
        "Comparación multitemporal de estructura, RSI, VWAP y Bollinger como marco conceptual; no se consultó un libro durante esta revisión.",
      ],
    },
  }),
};
