# Cloe Dashboard

Pantalla complementaria a `PreciosAlts` para visualizar el análisis técnico, fundamental y de acontecimientos de Cloe sin duplicar precios ni los gráficos principales de BTC/SOL.

## Estado

La aplicación usa autenticación de Supabase, protege el dashboard y lee únicamente los registros del usuario conectado mediante RLS. Cuando todavía no existen análisis, muestra estados vacíos en lugar de datos simulados.

## Arquitectura

- Next.js 16, React 19 y TypeScript.
- Tailwind CSS 4.
- Supabase como histórico acumulativo y autenticación.
- Vercel para vistas previas y producción.

La base separa datos objetivos, análisis independientes y síntesis. El esquema declarativo está versionado en `supabase/schema.sql` y en `supabase/migrations/`.

## Desarrollo

```bash
npm install
npm run dev
```

Variables previstas en `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Nunca se deben subir valores reales de estas variables a GitHub.

## Experimento `editor-pantalla`: escala automática y marcas propias

La raíz autenticada muestra TradingView BTCUSDT semanal como configuración inicial. La capa SVG es nuestra; los dibujos del iframe no se pueden leer desde el DOM. Los módulos de análisis y sus datos permanecen intactos.

### Flujo

1. En Chrome de escritorio compatible con **Region Capture**, pulsá **Activar escala automática** y compartí **esta pestaña**. El programa exige `displaySurface: browser` y `cropTo(CropTarget.fromElement(gráfico))`; rechaza escritorio, otra pestaña o un recorte con geometría distinta. La imagen se procesa localmente, sin API de pago.
2. Lee el eje cada aproximadamente 4 segundos **después** de terminar la lectura anterior. El estado muestra la fecha del frame y si hay escala válida. No asigna precios sobre un iframe vivo que pueda haber cambiado mientras lee.
3. Al elegir Línea, Horizontal o Libre desde vivo, **congela automáticamente el último frame validado**, con sus etiquetas, hash, dimensiones y escala. Los precios de los trazos corresponden exclusivamente a esa imagen fija. La captura queda pausada; Navegar vuelve a la vista viva anterior y reanuda lecturas sin volver a compartir. Detener captura o salir cierra tracks, worker y temporizadores.
4. En móviles/navegadores sin recorte de pestaña, **Datos / captura → Cargar captura** inicia el mismo OCR automático sobre la imagen. No exige escribir precios ni píxeles. Reescanear está disponible; calibración manual queda como alternativa secundaria sobre una imagen fija.
5. **Velas visuales** muestra H/L/O/C de componentes verdes/rojos compatibles con el esquema estándar. Son candidatos visuales estimados, no OHLC exactos de un feed, y su fecha es desconocida. Se ordenan por posición x, sin inventar timestamps de velas.

### Validación y abstención

- Tesseract.js 6 ejecuta OCR en el navegador sobre el 13 % derecho del gráfico, ampliado 3×. Adapta la lectura local y el parser ya existentes en `vista-graficosxrp`; no incorpora gateway ni rutas remotas de aquella rama. Worker, WASM e idioma se descargan desde CDNs públicos; no es una aplicación offline completa. Los píxeles no se envían a esos CDNs.
- Se exigen al menos tres etiquetas OCR confiables de una misma columna y panel superior, con separación vertical suficiente. El parser rechaza sufijos, caracteres dudosos y separadores ambiguos. Se comparan ajustes lineal/logarítmico robustos por pares y regresión, rechazando outliers, zona inferior/volumen y escalas ambiguas. Las distribuciones distintas del gráfico estándar pueden producir abstención.
- El precio automático es `≈` y solo se devuelve dentro del tramo vertical validado. La incertidumbre incluye error de ajuste y un mínimo de media altura de los glifos, porque centro de texto y tick no son equivalentes. No representa una garantía estadística de exactitud.
- El detector de velas requiere cuerpos y mechas legibles y colores estándar; excluye eje, zonas externas al tramo validado, doji, formas incompletas y colores desconocidos. Indicadores o superposiciones pueden impedir o confundir la lectura; nunca se presenta como dato exacto del mercado. Cambiar tema/color puede dejar cero candidatas.
- Navegación, geometría, referencia, visibilidad, error y trabajo nuevo invalidan los leases del frame; resultados asíncronos viejos no se aplican. Cada inicio de selector tiene generación propia y el contexto se revalida tras los permisos. Una captura fija conserva su correspondencia aunque luego cambie el widget.
- La unidad/activo y temporalidad de imágenes arbitrarias no están verificados. BTCUSDT/W son únicamente la configuración inicial del widget. No deducimos fechas, mercado o timeframe de cada vela.

### Persistencia y auditoría

El almacenamiento es local por usuario y dispositivo, sin escrituras en Supabase ni envío automático a Cloe. JSON conserva imágenes de referencia, etiquetas crudas/bboxes/confianzas, hash/timestamp del frame, ajustes rechazados/aceptados, incertidumbre, historial de escaneos/calibraciones y candidatos de velas. Los trazos conservan la calibración conocida al crearlos; las estimaciones actuales se exportan separadas, sin reescribir las originales. Cada fallo de escaneo conserva evidencia e invalida el mapping anterior. El loop vivo solo conserva su último frame en memoria; únicamente los frames congelados/capturas elegidos pasan al documento.

Importar JSON restaura el trabajo. Exportar JSON + capturas permite conservarlo si se agota la cuota del navegador; se muestra aviso cuando falla el guardado. SVG exporta la capa activa y sus metadatos, no el iframe de TradingView. Imágenes importadas se limitan a 15 MB/2400 px; el OCR admite hasta 12 megapíxeles. Ningún vídeo se guarda.

### Verificación reproducible

```bash
node --test scripts/chart-editor.test.mjs scripts/chart-vision.test.mjs
TESSDATA_PATH=/ruta/a/tessdata node scripts/chart-vision-ocr-check.mjs
npm run lint
npm run build
```

El segundo comando ejecuta **Tesseract.js real**, con `eng.traineddata` local sin comprimir, sobre `scripts/fixtures/axis-candles-synthetic.png`. Esa fixture independiente es **sintética**, no una captura real de TradingView: 1600×900, cinco etiquetas de precio, tres de RSI y 30 velas de colores estándar. La prueba real reconoce ocho etiquetas (confianza 94–96), conserva cinco del precio, rechaza tres de RSI y encuentra 30 candidatas con sus centros x correctos. En y=400, verdad sintética=100000; estimación≈100033.33 con incertidumbre≈233.33, que cubre el offset entre glifo y tick. Esto demuestra el flujo sobre esa fixture, no rendimiento validado en capturas reales.

Pruebas unitarias cubren parsing, escalas lineal/log, outliers, ambigüedad, rango/panel, incertidumbre, segmentación RGBA, referencias, historial y rechazo de carreras por revisión/teardown. Build/tipado y lint se verifican antes de publicar la rama. **No se verificó aún el selector Region Capture en un navegador real ni una captura real de TradingView**; el runtime no dispone de Chromium y su descarga oficial falló por ZIP vacío/truncado. Esas validaciones quedan explícitamente pendientes al probar la vista previa.
