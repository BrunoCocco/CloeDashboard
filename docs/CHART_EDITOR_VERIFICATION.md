# Editor de pantalla: verificación de captura

## Estado al 29 de octubre de 2026

Rama de trabajo: `editor-pantalla`. No se modifica la rama principal ni la autenticación.

El editor conserva una imagen congelada y su evidencia OCR para convertir trazos a **precios estimados**. Los candidatos H/L/O/C son geometría visual; no son OHLC de un proveedor ni tienen fechas verificadas.

## Correcciones de continuidad

- Congelar consulta de nuevo la sesión, referencia, revisión y dimensiones actuales. Una lectura guardada en un render anterior no puede usarse tras invalidación, aunque React todavía no haya repintado.
- La pérdida de foco, ocultación, redimensionado y cambio de referencia invalidan el frame disponible.
- Los cambios de referencia actualizan el contexto en el efecto de layout, antes de los eventos de la siguiente vista.
- Cada escaneo de imagen reserva su identidad antes de cualquier espera. Una imagen nueva o detener la captura gana frente a trabajos anteriores.
- Los resultados y errores de trabajos invalidados no sustituyen el estado vigente. La finalización de una sesión antigua no borra el estado de escaneo de otra sesión.
- El escaneo vivo se pausa al analizar una imagen sin reutilizar un worker abortado ni detener por error una sesión posterior.

## Comprobación reproducible

Desde la raíz del repositorio, con las dependencias instaladas:

```sh
node --test scripts/frame-scanner.test.mjs scripts/chart-editor.test.mjs scripts/chart-vision.test.mjs
npx eslint src/components/use-frame-scanner.ts src/components/chart-editor.tsx scripts/frame-scanner.test.mjs
npm run build
```

`frame-scanner.test.mjs` ejecuta el hook mediante un ciclo de vida determinista con React, DOM, media y OCR **simulados**. Cubre frames válidos, blur, resize antes y después del observador, referencia A→B→A, imágenes concurrentes, stop, sesión nueva, documento oculto y errores tardíos. Las pruebas existentes comprueban calibración, conservación de datos y liberación de recursos.

## Límite de la evidencia

El harness no es una prueba de navegador ni reconoce texto real. No valida el selector nativo de compartir pantalla, Region Capture, la descarga de modelos OCR ni el widget real de TradingView.

La descarga de Chromium en este entorno falló por un archivo truncado. La vista previa remota requiere acceso a Vercel, por lo que sigue pendiente una comprobación nativa interactiva autorizada en navegador compatible:

1. Abrir la vista del editor e iniciar «Activar escala automática»; elegir la pestaña actual.
2. Esperar un frame válido y congelarlo al elegir una herramienta de dibujo. Comprobar que imagen, escala y trazo corresponden al mismo frame.
3. Volver a navegar; cambiar escala o tamaño y comprobar que se espera una nueva lectura.
4. Cargar dos imágenes seguidas y cambiar de referencia durante el OCR. Solo debe aplicarse el resultado vigente.
5. Detener la captura o terminarla desde el navegador; no debe aparecer un frame tardío utilizable. Las capturas congeladas y sus dibujos deben mantenerse.

No presentar esta comprobación nativa como realizada hasta disponer de evidencia directa.
