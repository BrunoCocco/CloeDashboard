"use client";
/* eslint-disable @next/next/no-img-element -- Local blob remains on device. */
import { useState } from "react";
import {
  calibrate,
  localSummary,
  formatEstimatedPrice,
  type LocalReading,
  type Calibration,
} from "@/lib/captures/local-reading";
import type { LocalLine } from "@/lib/captures/local-lines";
import styles from "./capture-notebook.module.css";
type Point = { x: number; y: number };
export function LocalReadingEditor({
  src,
  width,
  height,
  lines,
  value,
  readOnly,
  onChange,
  onDirty,
}: {
  src: string;
  width: number;
  height: number;
  lines: LocalLine[];
  value: LocalReading | null;
  readOnly: boolean;
  onChange: (v: LocalReading | null) => void;
  onDirty: (v: boolean) => void;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [scale, setScale] = useState<Calibration["scale"]>("linear");
  const [panel, setPanel] = useState("Panel 1");
  const [error, setError] = useState("");
  function reset() {
    onDirty(true);
    onChange(null);
    setPoints([]);
    setSelecting(true);
    setError("");
  }
  function apply() {
    try {
      if (points.length !== 4 || [0, 1, 2, 3].some((i) => !points[i]))
        throw new Error(
          "Marcá las dos esquinas y después dos alturas del eje.",
        );
      const c: Calibration = {
        region: {
          x1: Math.min(points[0].x, points[1].x),
          x2: Math.max(points[0].x, points[1].x),
          y1: Math.min(points[0].y, points[1].y),
          y2: Math.max(points[0].y, points[1].y),
        },
        first: { y: points[2].y, price: Number(first) },
        second: { y: points[3].y, price: Number(second) },
        scale,
        panel,
      };
      onChange(calibrate(lines, c, width, height));
      setSelecting(false);
      onDirty(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisá la calibración.");
    }
  }
  const c = value?.calibration;
  const step = [
    "esquina superior izquierda del panel de precio",
    "esquina inferior derecha del mismo panel",
    "primera altura con precio conocido",
    "segunda altura con precio conocido",
  ][points.length];
  return (
    <section className={styles.section}>
      <h2>Lectura local de líneas</h2>
      <p>
        Elegí un solo panel de precio. Excluí RSI, volumen y otros paneles: cada
        eje requiere su propia calibración. Los precios resultantes son
        estimaciones revisables.
      </p>
      {!readOnly ? (
        <>
          <button type="button" onClick={reset}>
            Seleccionar panel y calibrar
          </button>{" "}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onDirty(false);
              setSelecting(false);
              setPoints([]);
            }}
          >
            Descartar lectura local
          </button>
          <p>
            Recalibrar elimina las decisiones de esta lectura; los niveles
            manuales independientes se conservan.
          </p>
        </>
      ) : null}
      <div style={{ position: "relative", width: "100%" }}>
        <img
          src={src}
          alt="Captura con líneas locales superpuestas"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Superposición de candidatas y región"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          {c ? (
            <rect
              x={c.region.x1}
              y={c.region.y1}
              width={c.region.x2 - c.region.x1}
              height={c.region.y2 - c.region.y1}
              fill="none"
              stroke="orange"
              strokeWidth={3}
            />
          ) : null}
          {(value?.candidates ?? []).map((l, i) => (
            <g key={l.id}>
              <line
                x1={l.x1}
                x2={l.x2}
                y1={l.y}
                y2={l.y}
                stroke={
                  l.decision === "rejected"
                    ? "#999"
                    : l.decision === "accepted"
                      ? "#00ff99"
                      : "#ffcc00"
                }
                strokeWidth={3}
                strokeDasharray={l.decision === "rejected" ? "6 6" : undefined}
              />
              <text
                x={l.x1 + 4}
                y={l.y - 5}
                fontSize={Math.max(14, width / 65)}
                fill="#fff"
                stroke="#111"
                strokeWidth={0.6}
              >
                {i + 1}
              </text>
            </g>
          ))}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={6} fill="#ff66cc" />
              <text x={p.x + 8} y={p.y} fill="white" fontSize={18}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
        {!readOnly && selecting && points.length < 4 ? (
          <button
            type="button"
            aria-label={`Marcar ${step}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "transparent",
              border: "2px solid #ff66cc",
              cursor: "crosshair",
            }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPoints((p) => [
                ...p,
                {
                  x: ((e.clientX - r.left) * width) / r.width,
                  y: ((e.clientY - r.top) * height) / r.height,
                },
              ]);
            }}
          >
            {" "}
          </button>
        ) : null}
      </div>
      {!readOnly && selecting ? (
        <>
          <p role="status">
            {points.length < 4
              ? `Tocá la imagen: ${step}.`
              : "Cuatro puntos marcados. Ingresá los dos precios."}{" "}
            También podés escribir coordenadas para una selección precisa con
            teclado.
          </p>
          <div className={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <label key={i}>
                Punto {i + 1} · x, y (píxeles)
                <input
                  aria-label={`Coordenadas punto ${i + 1}`}
                  key={points[i] ? `${points[i].x},${points[i].y}` : i}
                  defaultValue={
                    points[i]
                      ? `${Math.round(points[i].x)}, ${Math.round(points[i].y)}`
                      : ""
                  }
                  onBlur={(e) => {
                    const p = e.target.value.split(",").map(Number);
                    if (
                      p.length === 2 &&
                      p.every(Number.isFinite) &&
                      p[0] >= 0 &&
                      p[0] <= width &&
                      p[1] >= 0 &&
                      p[1] <= height
                    )
                      setPoints((prev) => {
                        const next = [...prev];
                        next[i] = { x: p[0], y: p[1] };
                        return next;
                      });
                    else {
                      setError(
                        "Coordenadas inválidas: escribí x, y dentro de la imagen.",
                      );
                      setPoints((prev) => {
                        const next = [...prev];
                        delete next[i];
                        return next;
                      });
                    }
                  }}
                />
              </label>
            ))}
          </div>
          <div className={styles.grid}>
            <label>
              Nombre del panel
              <input
                value={panel}
                maxLength={80}
                onChange={(e) => setPanel(e.target.value)}
              />
            </label>
            <label>
              Escala
              <select
                value={scale}
                onChange={(e) =>
                  setScale(e.target.value as Calibration["scale"])
                }
              >
                <option value="linear">Lineal</option>
                <option value="log">Logarítmica</option>
              </select>
            </label>
            <label>
              Precio en punto 3
              <input
                value={first}
                inputMode="decimal"
                onChange={(e) => setFirst(e.target.value)}
              />
            </label>
            <label>
              Precio en punto 4
              <input
                value={second}
                inputMode="decimal"
                onChange={(e) => setSecond(e.target.value)}
              />
            </label>
          </div>
          <button type="button" onClick={apply}>
            Aplicar calibración
          </button>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {value ? (
        <>
          <p>{value.summary ?? localSummary(value)}</p>
          <p>
            {c
              ? `Escala ${c.scale === "log" ? "logarítmica" : "lineal"} · puntos del eje: ${c.first.price} / ${c.second.price}. No es una cotización actual.`
              : "Sin calibración: geometría conservada, precios no determinados. No se pueden confirmar niveles sin calibrar."}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.readingTable}>
              <thead>
                <tr>
                  <th>Línea</th>
                  <th>Precio estimado</th>
                  <th>Clasificación humana</th>
                  <th>Revisión</th>
                </tr>
              </thead>
              <tbody>
                {value.candidates.map((l, i) => (
                  <tr key={l.id}>
                    <td>{i + 1}</td>
                    <td>
                      {l.estimatedPrice === null
                        ? "No determinado"
                        : formatEstimatedPrice(l.estimatedPrice)}
                    </td>
                    <td>
                      {readOnly ? (
                        l.classification === "support" ? (
                          "Soporte"
                        ) : l.classification === "resistance" ? (
                          "Resistencia"
                        ) : (
                          "Referencia"
                        )
                      ) : (
                        <select
                          aria-label={`Clasificación línea ${i + 1}`}
                          value={l.classification}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              candidates: value.candidates.map((item) =>
                                item.id === l.id
                                  ? {
                                      ...item,
                                      classification: e.target
                                        .value as typeof l.classification,
                                      decision: "pending",
                                    }
                                  : item,
                              ),
                            })
                          }
                        >
                          <option value="reference">Referencia</option>
                          <option value="support">Soporte</option>
                          <option value="resistance">Resistencia</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {readOnly ? (
                        l.decision === "accepted" ? (
                          "Aceptada por usuario"
                        ) : l.decision === "rejected" ? (
                          "Descartada"
                        ) : (
                          "Pendiente"
                        )
                      ) : (
                        <select
                          aria-label={`Revisión línea ${i + 1}`}
                          value={l.decision}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              candidates: value.candidates.map((item) =>
                                item.id === l.id
                                  ? {
                                      ...item,
                                      decision: e.target
                                        .value as typeof l.decision,
                                    }
                                  : item,
                              ),
                            })
                          }
                        >
                          <option value="pending">Pendiente</option>
                          <option
                            value="accepted"
                            disabled={l.estimatedPrice === null}
                          >
                            Confirmar nivel estimado
                          </option>
                          <option value="rejected">Descartar</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>Sin calibración aplicada. No hay precios recuperados.</p>
      )}
    </section>
  );
}
