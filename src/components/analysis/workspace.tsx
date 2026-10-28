"use client";
import { useEffect, useRef, useState } from "react";
import { ChartPanel } from "./chart-panel";
import { AssetFundamentalPanel } from "./fundamental-panel";
import {
  emptyFundamental,
  type AssetFundamentals,
} from "@/lib/analysis/fundamentals";
import {
  emptyWorkspace,
  FRAMES,
  parseWorkspace,
  SYMBOLS,
  type CandleBatch,
  type Frame,
  type SymbolCode,
  type Workspace,
} from "@/lib/analysis/model";

type Context = { available: boolean; cutoff: string; summary: string | null };
export function AnalysisWorkspace({
  userId,
  context,
  fundamentals,
}: {
  userId: string;
  context: Context;
  fundamentals: AssetFundamentals;
}) {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Cargando espacio local…");
  const [storageWarning, setStorageWarning] = useState("");
  const [cache, setCache] = useState<
    Partial<Record<SymbolCode, Partial<Record<Frame, CandleBatch>>>>
  >({});
  const [errors, setErrors] = useState<Partial<Record<Frame, string>>>({});
  const [generation, setGeneration] = useState(0);
  const [levelPrice, setLevelPrice] = useState("");
  const [levelLabel, setLevelLabel] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const storageKey = `cloe-analysis-v1:${userId}`;
  const symbol = workspace.selected;
  const asset = workspace.assets[symbol];
  const fundamental =
    fundamentals[symbol] ?? emptyFundamental(symbol, "unavailable");
  useEffect(() => {
    let value = emptyWorkspace(),
      warning = "";
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          value = parseWorkspace(JSON.parse(raw));
        } catch {
          localStorage.setItem(`${storageKey}:recovery`, raw);
          warning =
            "El espacio anterior no es válido. Se conservó una copia local de recuperación; no se importó.";
        }
      }
    } catch {
      warning =
        "Almacenamiento local no disponible. Exportá JSON para conservar tu trabajo.";
    }
    queueMicrotask(() => {
      setWorkspace(value);
      setStorageWarning(warning);
      setSaveStatus("Guardado local preparado");
      setHydrated(true);
    });
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(workspace));
        setSaveStatus("Guardado en este navegador");
      } catch {
        setSaveStatus(
          "No se pudo guardar. Descargá JSON para conservar tu trabajo.",
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [workspace, hydrated, storageKey]);
  useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(workspace));
      } catch {
        /* The visible save status already directs to JSON export. */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [workspace, hydrated, storageKey]);
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    queueMicrotask(() => setErrors({}));
    for (const frame of FRAMES) {
      fetch(`/api/market/candles?symbol=${symbol}&frame=${frame}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error ?? "No se pudo recuperar la serie");
          return data as CandleBatch;
        })
        .then((batch) => {
          if (!controller.signal.aborted)
            setCache((previous) => ({
              ...previous,
              [symbol]: { ...previous[symbol], [frame]: batch },
            }));
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setErrors((previous) => ({
              ...previous,
              [frame]:
                error instanceof Error ? error.message : "Datos no disponibles",
            }));
        });
    }
    return () => controller.abort();
  }, [symbol, hydrated, generation]);
  function update(change: (previous: Workspace) => Workspace) {
    setWorkspace((previous) => ({
      ...change(previous),
      updatedAt: new Date().toISOString(),
    }));
    setSaveStatus("Guardando…");
  }
  function addLevel(price: number) {
    if (!Number.isFinite(price) || price <= 0 || asset.levels.length >= 100)
      return;
    update((previous) => ({
      ...previous,
      assets: {
        ...previous.assets,
        [symbol]: {
          ...previous.assets[symbol],
          levels: [
            ...previous.assets[symbol].levels,
            {
              id: crypto.randomUUID(),
              price,
              label: levelLabel.trim().slice(0, 80) || "Nivel",
            },
          ],
        },
      },
    }));
    setLevelPrice("");
  }
  function download(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportJson() {
    download(
      JSON.stringify(
        {
          ...workspace,
          exportedAt: new Date().toISOString(),
          contextSnapshot: { ...context, assetFundamental: fundamental },
          marketSnapshot: cache,
        },
        null,
        2,
      ),
      `cloe-analisis-${symbol}.json`,
      "application/json",
    );
  }
  function exportCsv() {
    const rows = [
      "symbol,exchange,pair,currency,timeframe,time_utc,open,high,low,close,volume,is_last_open,fetched_at",
    ];
    for (const frame of FRAMES) {
      const batch = cache[symbol]?.[frame];
      batch?.candles.forEach((bar, index) =>
        rows.push(
          [
            symbol,
            "Kraken",
            batch.pair,
            "USD",
            frame,
            new Date(bar.time * 1000).toISOString(),
            bar.open,
            bar.high,
            bar.low,
            bar.close,
            bar.volume,
            index === batch.candles.length - 1,
            batch.fetchedAt,
          ].join(","),
        ),
      );
    }
    download(rows.join("\n"), `cloe-${symbol}-velas.csv`, "text/csv");
  }
  async function importJson(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Máximo 5 MB");
      const parsed = parseWorkspace(JSON.parse(await file.text()));
      // Keep a recovery copy before replacing local working notes.
      download(
        JSON.stringify(workspace, null, 2),
        "cloe-respaldo-antes-de-importar.json",
        "application/json",
      );
      update(() => parsed);
    } catch (error) {
      setSaveStatus(
        error instanceof Error
          ? `Importación rechazada: ${error.message}`
          : "Archivo inválido",
      );
    }
    if (input.current) input.current.value = "";
  }
  return (
    <div>
      <section className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-cyan-300">
            Espacio de análisis · Vista previa
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Del contexto al gráfico.
          </h1>
          <p className="mt-2 text-sm text-muted">
            Estudiá, anotá y conservá tu lectura de cada activo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button-secondary"
            disabled={!hydrated}
            onClick={() => input.current?.click()}
          >
            Importar JSON
          </button>
          <button
            className="button-primary"
            disabled={!hydrated}
            onClick={exportJson}
          >
            Exportar análisis ↓
          </button>
          <input
            className="hidden"
            ref={input}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importJson(event.target.files?.[0])}
            aria-label="Importar espacio de análisis"
          />
        </div>
      </section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 p-2">
        <nav className="flex flex-wrap gap-1" aria-label="Activo de análisis">
          {SYMBOLS.map((item) => (
            <button
              type="button"
              key={item}
              disabled={!hydrated}
              aria-pressed={item === symbol}
              onClick={() =>
                update((previous) => ({ ...previous, selected: item }))
              }
              className={
                item === symbol
                  ? "rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-black"
                  : "rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface hover:text-white"
              }
            >
              {item}
            </button>
          ))}
        </nav>
        <button
          onClick={() => setGeneration((value) => value + 1)}
          className="button-ghost"
          disabled={!hydrated}
        >
          Actualizar velas
        </button>
      </div>
      <AssetFundamentalPanel symbol={symbol} analysis={fundamental} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section
          className="grid min-w-0 gap-3"
          aria-label="Gráficos del activo"
        >
          {FRAMES.map((frame) => (
            <ChartPanel
              key={`${symbol}-${frame}`}
              frame={frame}
              batch={cache[symbol]?.[frame]}
              daily={cache[symbol]?.["1D"]}
              error={errors[frame]}
              levels={asset.levels}
              onLevel={addLevel}
            />
          ))}
          <p className="text-[11px] leading-5 text-muted">
            Motor{" "}
            <a
              className="text-cyan-300"
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noreferrer"
            >
              TradingView Lightweight Charts™
            </a>
            . Indicadores calculados por Cloe; fórmulas en prueba, comparación
            externa pendiente. Mercado Kraken USD en los siete activos. No
            importa dibujos de los widgets anteriores.
          </p>
        </section>
        <aside className="grid gap-3">
          <section className="panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Mi lectura · {symbol}</h2>
              <span className="badge badge-warning">Local</span>
            </div>
            <label
              className="mt-4 block text-xs text-muted"
              htmlFor="analysis-note"
            >
              Estructura, hipótesis e invalidación
            </label>
            <textarea
              id="analysis-note"
              disabled={!hydrated}
              className="form-input mt-2 min-h-40 resize-y text-sm"
              value={asset.note}
              maxLength={50000}
              placeholder="¿Qué observás? ¿Qué confirmaría o invalidaría tu hipótesis?"
              onChange={(event) =>
                update((previous) => ({
                  ...previous,
                  assets: {
                    ...previous.assets,
                    [symbol]: {
                      ...previous.assets[symbol],
                      note: event.target.value,
                    },
                  },
                }))
              }
            />
            <p role="status" className="mt-3 text-[11px] text-cyan-200">
              {saveStatus}
            </p>
            {storageWarning ? (
              <p role="alert" className="mt-2 text-[11px] text-amber-200">
                {storageWarning}
              </p>
            ) : null}
            <p className="mt-2 text-[11px] leading-5 text-muted">
              Notas y niveles persisten al cambiar de activo y recargar. Sólo en
              este navegador y usuario. Exportá JSON como respaldo.
            </p>
          </section>
          <section className="panel p-4">
            <h2 className="text-sm font-semibold">Niveles compartidos</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              Mismo activo y mercado, en las tres temporalidades. Ctrl + clic
              sobre el precio o ingresá un nivel.
            </p>
            <form
              className="mt-3 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addLevel(Number(levelPrice));
              }}
            >
              <label className="text-xs text-muted">
                Precio USD
                <input
                  type="number"
                  step="any"
                  min="0.00000001"
                  required
                  value={levelPrice}
                  onChange={(event) => setLevelPrice(event.target.value)}
                  className="form-input mt-1"
                />
              </label>
              <label className="text-xs text-muted">
                Etiqueta
                <input
                  maxLength={80}
                  value={levelLabel}
                  onChange={(event) => setLevelLabel(event.target.value)}
                  placeholder="Soporte / resistencia"
                  className="form-input mt-1"
                />
              </label>
              <button
                disabled={!hydrated || asset.levels.length >= 100}
                className="button-secondary"
              >
                Agregar nivel
              </button>
            </form>
            <ul className="mt-3 grid gap-2">
              {asset.levels.map((level) => (
                <li
                  key={level.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface p-2 text-xs"
                >
                  <span className="min-w-0 break-words">
                    <span className="text-amber-300">{level.label}</span>
                    <br />
                    {level.price.toLocaleString("es-ES", {
                      maximumFractionDigits: 8,
                    })}
                  </span>
                  <button
                    aria-label={`Eliminar ${level.label}`}
                    className="text-rose-300"
                    onClick={() =>
                      update((previous) => ({
                        ...previous,
                        assets: {
                          ...previous.assets,
                          [symbol]: {
                            ...previous.assets[symbol],
                            levels: previous.assets[symbol].levels.filter(
                              (item) => item.id !== level.id,
                            ),
                          },
                        },
                      }))
                    }
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel p-4">
            <h2 className="text-sm font-semibold">Archivo de investigación</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              JSON: restaura notas y niveles; incluye un corte de las velas
              consultadas, fundamental seleccionado y síntesis disponible. CSV:
              velas del activo. PNG: cada gráfico.
            </p>
            <button
              onClick={exportCsv}
              disabled={!cache[symbol] || !Object.keys(cache[symbol]!).length}
              className="button-ghost mt-3 w-full"
            >
              Descargar velas CSV
            </button>
            <p className="mt-3 text-[11px] text-amber-200">
              Pendiente: sincronización en la nube, trazados libres y PDF.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
