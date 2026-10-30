# Vista previa de histórico analítico — 2026-10-30

Base: `main` de CloeDashboard, commit `154221a6c2a58fda66b571ebf447d77d0e88a7fe`. Trabajo en `codex/analisis-historico`; no se modificó el proyecto Graficoxrp ni producción.

## Entregado

- Estándar de revisión versión1.0 guardado y enlazado desde el protocolo de actualización.
- Archivo nuevo en el dashboard: último corte por día de análisis/registro, selector por activo, selección histórica explícita, páginas de20 con cursor, estados vacío/error y exportación JSON. El precio capturado no se mezcla con cotizaciones del módulo legacy; los módulos anteriores conservan su corte propio y fallan de forma independiente.
- Ruta privada `/analisis/ejemplo` con transcripción BTC autorizada, fuente/hora inferida del nombre de archivo, hora de mercado desconocida, configuración real/unknown explícitos, hechos, hipótesis y escenarios contrarios. El ejemplo no fue insertado; registro nulo, exportación `example:true`. No se incluyeron imagen, nombre privado del archivo ni identificadores de Library/propietario en Git.
- SQL preparado `docs/sql/analysis-review-snapshots.sql`: tabla nueva con JSON versionado, índice del lector, RLS por propietario, solo SELECT autenticado e INSERT administrativo, clave idempotente por propietario y evento, corrección con FK compuesta, hora real de registro y rechazo de UPDATE/DELETE/TRUNCATE. Legacy intacto. **No aplicado a Supabase.** La evaluación de resultados futuros y su tabla/eventos quedan documentadas como pendientes; no se simulan resultados.

## Evidencia

- TypeScript y lint correctos. Suite completa: **7/7 pruebas correctas**, incluyendo contrato/unknown, no promoción de hora del archivo, filtro propietario en lista/detalle, orden, selección histórica, cursor con microsegundos, ausencia de sustitución por demo y regresión de eventos existentes.
- Build normal bloqueado por descarga de Google Fonts preexistentes (Geist/Geist Mono) desde este entorno. Build de aplicación correcto usando `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` únicamente en la invocación local, con fuentes locales de prueba. No se cambió la configuración/fuente de la app ni se desactivó TLS. La compilación real con recursos de producción debe comprobarse en Vercel.
- El coordinador ejecutó el SQL en **PGlite/PostgreSQL18.6 local WASM**: creación e ingreso administrativo, sello horario, rechazo de JSON vacío/hora inconsistente y corrección de otro dueño, bloqueo de mutaciones, RLS de dos propietarios, permisos anon/autenticado/service_role e idempotencia `ON CONFLICT DO NOTHING` correctos. Esa prueba no equivale al PostgreSQL17 de la nube ni a advisors de Supabase.
- El coordinador revisó el componente original en navegador real, escritorio y móvil: sin desbordamiento ni errores JavaScript; descarga JSON mantuvo marca de ejemplo, registro/hora observada nulos, fuente de nombre de archivo y bibliografía consultada vacía. Evidencia temporal externa al repo: `product-browser/history-desktop.png` y `history-mobile.png`. Es una prueba de componente aislado; no valida login ni consulta de la base real.

## Pendiente para uso real

El conector del proyecto correcto `wvwxwutjdqsktnrcdbkf` denegó `get_project` y SQL de lectura según comprobación del coordinador. Esto no prueba que el servicio runtime esté apagado. No se migró ni cargó un análisis real, no se verificó RLS/advisors contra la nube y no se afirma histórico operativo todavía. Antes de aplicar: confirmar esquema remoto, generar migración con CLI, revisión administrativa, pruebas/advisors, cargar un corte real idempotente y verificar su SELECT y pantalla autenticada. La ruta de ejemplo permite revisar la propuesta mientras ese acceso se resuelve.
