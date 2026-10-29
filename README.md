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

## Experimento `editor-pantalla`

La raíz autenticada muestra TradingView BTCUSDT semanal como configuración inicial, con una capa SVG propia. `Navegar` deja pasar gestos al gráfico; `Línea`, `Horizontal` y `Libre` dibujan encima. Seleccioná un trazo para leer coordenadas normalizadas y píxeles relativos al fondo. `Deshacer` retira el último trazo; `Borrar` elimina el seleccionado. Los trazos pertenecen a una referencia de pantalla y no están anclados a velas ni fechas.

En **Datos / captura**, cargá una imagen para trabajar sobre una referencia estable. Se crea una escena nueva, con dibujos y calibración independientes. La imagen se reduce a un máximo de 2400 px y se guarda en el navegador junto con el documento; se puede volver a otras referencias. El activo y temporalidad de una captura no están verificados.

Para estimar precios, marcá dos alturas de etiquetas del mismo eje de precios (no del volumen), introducí precios positivos sin separadores de miles y elegí escala lineal o logarítmica. La referencia superior debe tener un precio mayor. Se indican valores estimados y extrapolaciones fuera de las referencias. Cada calibración aplicada o invalidada queda en el historial; los trazos conservan la calibración existente al crearlos y el JSON diferencia esa lectura de una estimación actual.

TradingView está en un iframe de otro origen: esta aplicación no puede leer su escala, temporalidad, velas o dibujos, ni rasterizarlo desde el DOM. Al navegar, cambiar tamaño, perder foco o restaurar una vista viva se invalida la calibración. Los cambios internos/automáticos del iframe no son detectables; para comparaciones reproducibles usá una captura congelada. Esta versión **no ejecuta OCR**. No se encontró detector local integrado en este repo: su conexión es trabajo posterior.

La persistencia se separa por usuario autenticado y dispositivo (`localStorage`); no escribe datos en Supabase ni envía dibujos a Cloe automáticamente. Exportá **JSON + capturas** para conservar referencias, puntos brutos, metadatos, calibraciones e historial; si el navegador no permite guardar o agota su cuota se muestra aviso y la exportación sigue disponible. **SVG** exporta la capa activa con metadatos, no la imagen de TradingView. **Importar JSON** permite restaurar el paquete exportado y sus capturas en otro momento; el estado vivo se restaura sin calibración activa. El documento tiene versión 1 para una futura integración con el detector. Las capturas locales no se suben a servicios externos.
