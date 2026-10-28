"use client";
/* eslint-disable @next/next/no-img-element -- Local blob previews never pass through the Next image proxy. */
import { useEffect, useRef, useState } from "react";
import {
  buildMetadata,
  numericCandidates,
  positivePrice,
  type CaptureMetadata,
  type CaptureRecord,
  type DraftMetadata,
  type ReviewedLevel,
} from "@/lib/captures/model";
import { listCaptures, readCapture, saveCapture } from "@/lib/captures/storage";
import { imageDataUrl, normalizeImage, screenshot } from "@/lib/captures/image";
import { readCaptureText } from "@/lib/captures/ocr";
import styles from "./capture-notebook.module.css";
type DraftImage = {
  image: Blob;
  width: number;
  height: number;
  method: "screen" | "upload";
  capturedAt: string | null;
};
function initial(asset: string, market: string): DraftMetadata {
  const [exchange, pair] = market.split(":");
  return {
    asset,
    exchange: exchange ?? "",
    pair: pair ?? "",
    timeframe: "ALL",
    title: "",
    notes: "",
    hypothesis: "",
    invalidation: "",
    observedAt: "",
    reviewed: false,
  };
}
function localDate(value: string | null) {
  return value ? new Date(value).toLocaleString("es-ES") : "No informada";
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CaptureNotebook({
  userId,
  asset,
  market,
}: {
  userId: string;
  asset: string;
  market: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "history">("new");
  const [draft, setDraft] = useState(() => initial(asset, market));
  const [image, setImage] = useState<DraftImage | null>(null);
  const [preview, setPreview] = useState("");
  const [levels, setLevels] = useState<ReviewedLevel[]>([]);
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<ReviewedLevel["kind"]>("reference");
  const [label, setLabel] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<CaptureMetadata[]>([]);
  const [historyAsset, setHistoryAsset] = useState(asset);
  const [record, setRecord] = useState<CaptureRecord | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const ocrAbort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const capturePending = useRef(false);
  const imageGeneration = useRef(0);
  const historyGeneration = useRef(0);
  const draftStarted = useRef(false);
  const draftSaved = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ocrAbort.current?.abort();
    };
  }, []);
  useEffect(() => {
    const blob = record?.image ?? image?.image;
    if (!blob) {
      queueMicrotask(() => setPreview(""));
      return;
    }
    const url = URL.createObjectURL(blob);
    queueMicrotask(() => setPreview(url));
    return () => URL.revokeObjectURL(url);
  }, [image, record]);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  async function reloadHistory(filter: string) {
    const generation = ++historyGeneration.current;
    const rows = await listCaptures(userId, filter || undefined);
    if (alive.current && generation === historyGeneration.current)
      setHistory(rows);
  }
  function close() {
    ocrAbort.current?.abort();
    setOpen(false);
    opener.current?.focus();
  }
  function start() {
    if (
      draftStarted.current &&
      !draftSaved.current &&
      (image ||
        draft.title ||
        draft.notes ||
        draft.hypothesis ||
        draft.invalidation ||
        levels.length ||
        ocrText) &&
      !window.confirm(
        "Hay un borrador sin guardar. ¿Descartarlo y comenzar un corte nuevo?",
      )
    )
      return;
    draftStarted.current = true;
    draftSaved.current = false;
    ocrAbort.current?.abort();
    imageGeneration.current++;
    historyGeneration.current++;
    setRecord(null);
    setMode("new");
    setDraft(initial(asset, market));
    setImage(null);
    setLevels([]);
    setPrice("");
    setLabel("");
    setOcrText("");
    setMessage("");
    setOpen(true);
  }
  function resume() {
    if (draftStarted.current && !draftSaved.current) {
      setMode("new");
      setRecord(null);
      setOpen(true);
      setMessage(
        `Borrador de ${draft.asset} retomado. La ficha conserva su activo y mercado originales; revisalos antes de guardar.`,
      );
    } else start();
  }
  async function acceptImage(
    blob: Blob,
    method: DraftImage["method"],
    capturedAt: string | null,
  ) {
    const generation = ++imageGeneration.current;
    ocrAbort.current?.abort();
    setOcrText("");
    const normalized = await normalizeImage(blob);
    if (!alive.current || generation !== imageGeneration.current) return;
    setImage({ ...normalized, method, capturedAt });
    setLevels([]);
    setDraft((previous) => ({ ...previous, reviewed: false }));
  }
  async function capture() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMessage(
        "Este navegador no permite capturar pestañas. Usá Cargar imagen.",
      );
      return;
    }
    if (capturePending.current) return;
    capturePending.current = true;
    // Must run immediately in this button gesture, before any await.
    let requested: Promise<MediaStream>;
    try {
      requested = navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);
    } catch {
      capturePending.current = false;
      setMessage(
        "El navegador no permitió iniciar la captura. Usá Cargar imagen.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    setOpen(false);
    let stream: MediaStream | null = null;
    try {
      stream = await requested;
      if (!alive.current) return;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const blob = await screenshot(stream);
      stream.getTracks().forEach((track) => track.stop());
      await acceptImage(blob, "screen", new Date().toISOString());
    } catch {
      if (alive.current)
        setMessage(
          "Captura cancelada o no disponible. Podés elegir una pestaña nuevamente o cargar una imagen.",
        );
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      capturePending.current = false;
      if (alive.current) {
        setBusy(false);
        setOpen(true);
      }
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      await acceptImage(file, "upload", null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo abrir la imagen.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function ocr() {
    if (!image) return;
    ocrAbort.current?.abort();
    const controller = new AbortController();
    ocrAbort.current = controller;
    const generation = imageGeneration.current;
    setOcrBusy(true);
    setMessage("");
    try {
      const text = await readCaptureText(image.image, controller.signal);
      if (
        alive.current &&
        generation === imageGeneration.current &&
        !controller.signal.aborted
      ) {
        setOcrText(text);
        setDraft((previous) => ({ ...previous, reviewed: false }));
      }
    } catch (error) {
      if (alive.current && generation === imageGeneration.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo leer el texto. Continuá manualmente.",
        );
    } finally {
      if (alive.current && ocrAbort.current === controller) setOcrBusy(false);
    }
  }
  function confirmLevel() {
    try {
      const value = positivePrice(price);
      if (!label.trim() || label.length > 80 || levels.length >= 50)
        throw new Error(
          "Agregá una etiqueta de hasta 80 caracteres; máximo 50 niveles.",
        );
      setLevels((previous) => [
        ...previous,
        { price: value, kind, label: label.trim(), confirmed: true },
      ]);
      setDraft((previous) => ({ ...previous, reviewed: false }));
      setPrice("");
      setLabel("");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nivel inválido.");
    }
  }
  async function save() {
    if (!image) {
      setMessage("Capturá o cargá una imagen antes de guardar.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const metadata = buildMetadata(userId, draft, image, levels, ocrText);
      const snapshot = { ...metadata, image: image.image };
      await saveCapture(snapshot);
      draftSaved.current = true;
      setRecord(snapshot);
      setMode("history");
      setMessage(
        "Corte guardado en este navegador. No está sincronizado en la nube.",
      );
      await reloadHistory("");
      setHistoryAsset("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el corte local.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function showHistory() {
    setMode("history");
    setRecord(null);
    setMessage("");
    setHistoryAsset(asset);
    setOpen(true);
    setBusy(true);
    try {
      await reloadHistory(asset);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo abrir el histórico.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function showRecord(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const found = await readCapture(userId, id);
      if (!found)
        throw new Error("Este corte no está disponible para tu usuario.");
      setRecord(found);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo abrir el corte.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportJson() {
    try {
      const snapshot =
        record ??
        (image
          ? {
              ...buildMetadata(userId, draft, image, levels, ocrText),
              image: image.image,
            }
          : null);
      if (!snapshot)
        throw new Error("No hay una captura revisada para exportar.");
      const { ownerId: _ownerId, image: blob, ...metadata } = snapshot;
      void _ownerId;
      const content = {
        ...metadata,
        exportedAt: new Date().toISOString(),
        storage: "local-browser",
        image: await imageDataUrl(blob),
      };
      download(
        new Blob([JSON.stringify(content, null, 2)], {
          type: "application/json",
        }),
        `cloe-${snapshot.asset}-${snapshot.id}.json`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo exportar.",
      );
    }
  }
  function field<K extends keyof DraftMetadata>(
    key: K,
    value: DraftMetadata[K],
  ) {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key !== "reviewed" ? { reviewed: false } : {}),
    }));
  }
  const visible = record ?? draft;
  return (
    <>
      <div className={styles.toolbar}>
        <span>
          Cuaderno de análisis <small>Local · sin nube</small>
        </span>
        <div>
          <button type="button" ref={opener} disabled={busy} onClick={resume}>
            Guardar análisis
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void showHistory()}
          >
            Histórico
          </button>
        </div>
      </div>
      <dialog
        ref={dialog}
        className={styles.dialog}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        aria-labelledby="capture-title"
      >
        <div className={styles.head}>
          <div>
            <h1 id="capture-title">
              {mode === "history"
                ? "Histórico de análisis"
                : "Guardar análisis revisado"}
            </h1>
            <p>
              La vista de gráficos permanece montada. Tus dibujos siguen en la
              sesión.
            </p>
          </div>
          <button type="button" aria-label="Cerrar cuaderno" onClick={close}>
            Cerrar
          </button>
        </div>
        <div className={styles.body}>
          {message ? (
            <p className={styles.message} role="status">
              {message}
            </p>
          ) : null}
          {mode === "history" ? (
            <>
              <div className={styles.row}>
                <label>
                  Filtrar por activo
                  <select
                    value={historyAsset}
                    onChange={(event) => {
                      setHistoryAsset(event.target.value);
                      void reloadHistory(event.target.value).catch(() =>
                        setMessage("No se pudo filtrar el histórico."),
                      );
                    }}
                  >
                    <option value="">Todos mis activos</option>
                    {[
                      ...new Set([asset, ...history.map((item) => item.asset)]),
                    ].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <button type="button" disabled={busy} onClick={start}>
                  Nuevo corte
                </button>
              </div>
              <p className={styles.notice}>
                Hasta los últimos 100 cortes del filtro. El archivo anterior se
                conserva.
              </p>
              <ul className={styles.history}>
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void showRecord(item.id)}
                    >
                      <strong>
                        {item.asset} · {item.title}
                      </strong>
                      <span>
                        {item.timeframe} · guardado {localDate(item.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!history.length && !busy ? (
                <p>
                  No hay cortes guardados para este filtro. Se muestran hasta
                  los últimos 100.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className={styles.notice}>
                Elegí únicamente la pestaña o ventana que querés guardar. Revisá
                que la imagen no contenga información privada ajena al análisis.
              </p>
              <div className={styles.row}>
                <button
                  type="button"
                  disabled={busy || ocrBusy}
                  onClick={() => void capture()}
                >
                  Capturar pestaña
                </button>
                <button
                  type="button"
                  disabled={busy || ocrBusy}
                  onClick={() => input.current?.click()}
                >
                  Cargar imagen
                </button>
                <input
                  ref={input}
                  className={styles.file}
                  aria-label="Cargar captura PNG, JPEG o WebP"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
              </div>
              <p>
                PNG/JPEG/WebP, hasta 12 MB y 20 megapíxeles. La copia se
                normaliza a PNG.
              </p>
            </>
          )}
          {mode === "new" || record ? (
            <>
              {preview && (mode === "new" || record) ? (
                <img
                  className={styles.preview}
                  src={preview}
                  alt={
                    record
                      ? `Corte guardado: ${record.title}`
                      : "Captura a revisar antes de guardar"
                  }
                />
              ) : null}
              {record ? (
                <p className={styles.notice}>
                  Corte de sólo lectura. Guardado: {localDate(record.createdAt)}{" "}
                  · Captura en app: {localDate(record.capturedAt)} ·
                  Observación: {localDate(record.observedAt)}. No representa
                  necesariamente el mercado actual.
                </p>
              ) : (
                <p className={styles.notice}>
                  El widget puede tener otro símbolo cambiado desde su propia
                  barra. Activo y mercado son sugerencias: comprobá la imagen y
                  corregí la ficha.
                </p>
              )}
              <div className={styles.grid}>
                {(
                  [
                    ["asset", "Activo"],
                    ["exchange", "Exchange"],
                    ["pair", "Par"],
                    ["title", "Título"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      value={visible[key]}
                      readOnly={Boolean(record)}
                      maxLength={
                        key === "title"
                          ? 160
                          : key === "asset"
                            ? 24
                            : key === "pair"
                              ? 48
                              : 80
                      }
                      onChange={(event) => field(key, event.target.value)}
                    />
                  </label>
                ))}
                <label>
                  Temporalidad
                  <select
                    value={visible.timeframe}
                    disabled={Boolean(record)}
                    onChange={(event) => field("timeframe", event.target.value)}
                  >
                    <option value="ALL">Tres gráficos</option>
                    <option value="1W">Semanal</option>
                    <option value="1D">Diario</option>
                    <option value="4H">4 horas</option>
                  </select>
                </label>
                <label>
                  Fecha de observación (opcional; hora de este dispositivo)
                  {record ? (
                    <input readOnly value={localDate(record.observedAt)} />
                  ) : (
                    <input
                      type="datetime-local"
                      value={draft.observedAt}
                      onChange={(event) =>
                        field("observedAt", event.target.value)
                      }
                    />
                  )}
                </label>
              </div>
              <div className={styles.grid}>
                {(
                  [
                    ["notes", "Observaciones"],
                    ["hypothesis", "Hipótesis"],
                    ["invalidation", "¿Qué invalidaría la hipótesis?"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <textarea
                      value={visible[key]}
                      readOnly={Boolean(record)}
                      maxLength={key === "notes" ? 30000 : 10000}
                      onChange={(event) => field(key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              {!record && image ? (
                <section className={styles.section}>
                  <h2>Lectura asistida del texto</h2>
                  <p>
                    OCR local: descarga motor/modelo públicos, pero procesa la
                    imagen en este navegador. No interpreta líneas, velas ni
                    dibujos. Los números pueden ser fechas, ejes o texto mal
                    leído.
                  </p>
                  <div className={styles.row}>
                    <button
                      type="button"
                      disabled={busy || ocrBusy}
                      onClick={() => void ocr()}
                    >
                      Leer texto de captura (OCR)
                    </button>
                    {ocrBusy ? (
                      <button
                        type="button"
                        onClick={() => ocrAbort.current?.abort()}
                      >
                        Cancelar OCR
                      </button>
                    ) : null}
                  </div>
                  {ocrBusy ? (
                    <p role="status">
                      Leyendo texto; la primera carga puede tardar. Límite: 90
                      segundos.
                    </p>
                  ) : null}
                  <label>
                    Texto bruto OCR (revisable)
                    <textarea
                      value={ocrText}
                      maxLength={100000}
                      onChange={(event) => {
                        setOcrText(event.target.value);
                        setDraft((previous) => ({
                          ...previous,
                          reviewed: false,
                        }));
                      }}
                    />
                  </label>
                  <div className={styles.candidates}>
                    {numericCandidates(ocrText).map((candidate, index) => (
                      <button
                        type="button"
                        key={index}
                        onClick={() => {
                          setPrice(candidate);
                          setMessage(
                            "Token copiado. Revisá si realmente es un precio y corregí separadores antes de confirmarlo.",
                          );
                        }}
                      >
                        {candidate}
                      </button>
                    ))}
                  </div>
                </section>
              ) : record?.ocrText ? (
                <details className={styles.section}>
                  <summary>Texto OCR conservado</summary>
                  <pre className={styles.raw}>{record.ocrText}</pre>
                </details>
              ) : null}
              <section className={styles.section}>
                <h2>Niveles revisados</h2>
                {!record ? (
                  <>
                    <p>
                      Ningún número se convierte en nivel automáticamente.
                      Precio con punto decimal, sin separador de miles.
                    </p>
                    <div className={styles.grid}>
                      <label>
                        Precio a confirmar
                        <input
                          value={price}
                          inputMode="decimal"
                          onChange={(event) => setPrice(event.target.value)}
                        />
                      </label>
                      <label>
                        Clasificación
                        <select
                          value={kind}
                          onChange={(event) =>
                            setKind(event.target.value as ReviewedLevel["kind"])
                          }
                        >
                          <option value="reference">Referencia</option>
                          <option value="support">Soporte</option>
                          <option value="resistance">Resistencia</option>
                        </select>
                      </label>
                      <label>
                        Etiqueta
                        <input
                          value={label}
                          maxLength={80}
                          onChange={(event) => setLabel(event.target.value)}
                        />
                      </label>
                    </div>
                    {price ? (
                      <p className={styles.notice}>
                        Interpretación con punto decimal:{" "}
                        {/^\d+(?:\.\d+)?$/.test(price.trim()) &&
                        Number.isFinite(Number(price))
                          ? Number(price).toLocaleString("es-ES", {
                              maximumFractionDigits: 12,
                            })
                          : "corregí el formato antes de confirmar"}
                        . No se asumen separadores de miles.
                      </p>
                    ) : null}
                    <button type="button" onClick={confirmLevel}>
                      Confirmar este nivel
                    </button>
                  </>
                ) : null}
                <ul>
                  {(record?.levels ?? levels).map((level, index) => (
                    <li key={index}>
                      {level.label} ·{" "}
                      {level.kind === "support"
                        ? "Soporte"
                        : level.kind === "resistance"
                          ? "Resistencia"
                          : "Referencia"}{" "}
                      · {level.price}
                      {!record ? (
                        <button
                          type="button"
                          aria-label={`Quitar nivel ${level.label}`}
                          onClick={() => {
                            setLevels((previous) =>
                              previous.filter((_, i) => i !== index),
                            );
                            setDraft((previous) => ({
                              ...previous,
                              reviewed: false,
                            }));
                          }}
                        >
                          Quitar
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
              {!record ? (
                <label className={styles.confirm}>
                  <input
                    type="checkbox"
                    checked={draft.reviewed}
                    onChange={(event) =>
                      field("reviewed", event.target.checked)
                    }
                  />
                  Confirmo que revisé la captura, el activo, el mercado, la
                  temporalidad y los niveles. La fecha de observación sólo se
                  aporta si la conozco.
                </label>
              ) : null}
              <div className={styles.row}>
                {!record ? (
                  <button
                    type="button"
                    disabled={busy || ocrBusy || !image}
                    onClick={() => void save()}
                  >
                    Guardar corte en este navegador
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || (!image && !record)}
                  onClick={() => {
                    const blob = record?.image ?? image?.image;
                    if (blob)
                      download(blob, `cloe-${visible.asset}-captura.png`);
                  }}
                >
                  Exportar PNG
                </button>
                <button
                  type="button"
                  disabled={busy || ocrBusy || (!image && !record)}
                  onClick={() => void exportJson()}
                >
                  Exportar JSON con imagen
                </button>
              </div>
            </>
          ) : null}
          <p className={styles.notice}>
            Cada guardado crea un corte nuevo. Archivo local por usuario en este
            navegador; no está cifrado ni sincronizado con Supabase. Exportá
            respaldo: borrar datos del navegador elimina este histórico.
          </p>
        </div>
      </dialog>
    </>
  );
}
