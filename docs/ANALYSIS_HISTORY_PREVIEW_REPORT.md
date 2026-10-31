# Vista previa de histórico analítico — 2026-10-30

Base: `main` de CloeDashboard, commit `154221a6c2a58fda66b571ebf447d77d0e88a7fe`. Trabajo en `codex/analisis-historico`; no se modificó el proyecto Graficoxrp ni producción.

## Corte inicial de la vista previa (antes de habilitar acceso a la nube)

### Entregado

- Estándar de revisión versión1.0 guardado y enlazado desde el protocolo de actualización.
- Archivo nuevo en el dashboard: último corte por día de análisis/registro, selector por activo, selección histórica explícita, páginas de20 con cursor, estados vacío/error y exportación JSON. El precio capturado no se mezcla con cotizaciones del módulo legacy; los módulos anteriores conservan su corte propio y fallan de forma independiente.
- Ruta privada `/analisis/ejemplo` con transcripción BTC autorizada, fuente/hora inferida del nombre de archivo, hora de mercado desconocida, configuración real/unknown explícitos, hechos, hipótesis y escenarios contrarios. El ejemplo no fue insertado; registro nulo, exportación `example:true`. No se incluyeron imagen, nombre privado del archivo ni identificadores de Library/propietario en Git.
- SQL preparado `docs/sql/analysis-review-snapshots.sql`: tabla nueva con JSON versionado, índice del lector, RLS por propietario, solo SELECT autenticado e INSERT administrativo, clave idempotente por propietario y evento, corrección con FK compuesta, hora real de registro y rechazo de UPDATE/DELETE/TRUNCATE. Legacy intacto. **No aplicado a Supabase.** La evaluación de resultados futuros y su tabla/eventos quedan documentadas como pendientes; no se simulan resultados.

### Evidencia del corte inicial

- TypeScript y lint correctos. Suite completa: **7/7 pruebas correctas**, incluyendo contrato/unknown, no promoción de hora del archivo, filtro propietario en lista/detalle, orden, selección histórica, cursor con microsegundos, ausencia de sustitución por demo y regresión de eventos existentes.
- Build normal bloqueado por descarga de Google Fonts preexistentes (Geist/Geist Mono) desde este entorno. Build de aplicación correcto usando `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` únicamente en la invocación local, con fuentes locales de prueba. No se cambió la configuración/fuente de la app ni se desactivó TLS. La compilación real con recursos de producción debe comprobarse en Vercel.
- El coordinador ejecutó el SQL en **PGlite/PostgreSQL18.6 local WASM**: creación e ingreso administrativo, sello horario, rechazo de JSON vacío/hora inconsistente y corrección de otro dueño, bloqueo de mutaciones, RLS de dos propietarios, permisos anon/autenticado/service_role e idempotencia `ON CONFLICT DO NOTHING` correctos. Esa prueba no equivale al PostgreSQL17 de la nube ni a advisors de Supabase.
- El coordinador revisó el componente original en navegador real, escritorio y móvil: sin desbordamiento ni errores JavaScript; descarga JSON mantuvo marca de ejemplo, registro/hora observada nulos, fuente de nombre de archivo y bibliografía consultada vacía. Evidencia temporal externa al repo: `product-browser/history-desktop.png` y `history-mobile.png`. Es una prueba de componente aislado; no valida login ni consulta de la base real.

### Pendientes del corte inicial

El conector del proyecto correcto `wvwxwutjdqsktnrcdbkf` denegó `get_project` y SQL de lectura según comprobación del coordinador. Esto no prueba que el servicio runtime esté apagado. No se migró ni cargó un análisis real, no se verificó RLS/advisors contra la nube y no se afirma histórico operativo todavía. Antes de aplicar: confirmar esquema remoto, generar migración con CLI, revisión administrativa, pruebas/advisors, cargar un corte real idempotente y verificar su SELECT y pantalla autenticada. La ruta de ejemplo permite revisar la propuesta mientras ese acceso se resuelve.


## Actualización posterior: acceso y primera carga en CloeDashboard

El coordinador recuperó acceso administrativo a la conexión autorizada y verificó el proyecto correcto `wvwxwutjdqsktnrcdbkf` como `ACTIVE_HEALTHY`, PostgreSQL 17.6. La consulta SQL de lectura funcionó y confirmó inicialmente que la tabla del archivo todavía no existía. Esto sustituye el bloqueo de acceso descrito en el corte inicial; no se cambió el proyecto destino ni se usó la base de Graficoxrp.

Supabase confirmó `success:true` al aplicar la migración `analysis_review_snapshots` en la nube. El coordinador insertó después el primer corte BTC del día 2026-10-30 con clave de ingesta idempotente, hora observada nula y registro real de DB `2026-10-30T17:14:00.827296+00:00`. El snapshot real parte de la transcripción revisada de la captura, con descripción de fuente de análisis aportado por el usuario; no se insertó la marca de ejemplo de la UI ni se cambió la fixture privada de prueba. No se incorporan identidades de usuario ni secretos a este informe.

La línea base previa registrada fue de 154 análisis técnicos, 22 síntesis y 1080 velas. La migración agrega su propia tabla y no transforma los datos legacy. La comprobación posterior del lector, RLS con rol del usuario, asesores y visualización autenticada sigue pendiente de los resultados del coordinador; una aplicación exitosa y una inserción no bastan para declarar la integración completa.

La creación de un archivo local con Supabase CLI quedó bloqueada: los dos intentos de ejecución aislada finalizaron con cancelación de aprobación de red antes de devolver una decisión. Se verificó la versión publicada 2.122.0, pero no se ejecutó el binario. **No se fabricó un nombre de archivo de migración.** La herramienta de Supabase sí registró la migración en la nube; antes de sincronizar su historial con archivos locales se debe recuperar su versión real, sin volver a ejecutar el DDL.

### Verificación posterior en la nube, comunicada por el coordinador

- PostgreSQL 17.6: una consulta con rol `authenticated` y claims del propietario recuperó el primer corte BTC, día 2026-10-30, 15 hechos y hora observada/mercado nula. Otra identidad usada solo como claims en SQL obtuvo cero filas: se comprobó RLS con otra identidad, no una nueva cuenta ni su login real. `anon` no tiene SELECT y `authenticated` no tiene INSERT.
- Supabase registró las versiones `20261030171301` (`analysis_review_snapshots`) y `20261030171706` (`analysis_reviews_revision_owner_index`). El segundo ingreso agrega el índice `(revision_of, user_id)` para la FK de corrección, tras una observación del asesor de rendimiento. Su DDL de referencia se conserva separado en `docs/sql/analysis-review-revision-owner-index.sql`; no se alteró el cuerpo del SQL de la primera migración como si el índice ya hubiera estado incluido.
- El asesor de seguridad solo informó el aviso preexistente de protección contra contraseñas filtradas desactivada. No se cambió la configuración de Auth. Referencia oficial: [seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- La lectura administrativa y con rol del usuario no equivalen a comprobar la UI autenticada. Siguen pendientes, al cerrar este corte, el recuento final/idempotencia y el asesor de rendimiento posterior al índice que el coordinador está ejecutando, además del recorrido de login y pantalla privada real.

### Cierre adicional verificado en nube

El reintento de la misma `ingestion_key` conservó exactamente un corte nuevo. Los conteos finales coinciden con los originales: 154 análisis técnicos, 22 síntesis y 1.080 velas; el archivo nuevo contiene 1 corte BTC. Después de añadir el índice de correcciones, advisors de rendimiento ya no informa claves foráneas sin índice; quedan avisos informativos de índices aún sin uso, que no se eliminaron. La verificación visual de sesión autenticada en el despliegue sigue sin realizarse; no se presenta como completada.

## Iteración de presentación compacta

Se recortó la superficie principal a corte/fecha, síntesis breve, dos escenarios y un único desplegable de análisis completo. El histórico empieza cerrado; los módulos anteriores se solicitan desde «Contexto de mercado» y muestran su fecha independiente. Se eliminaron de la vista inicial las instrucciones sobre DB/orden, el enlace de demo, las tres tarjetas de timestamps y las afirmaciones redundantes de sincronización. La prueba conserva solo un distintivo discreto. Un precio numérico se muestra como «En captura» únicamente si existe el dato `price` visible con unidad coincidente; nunca como cotización actual.

Medición del coordinador en navegador real con el mismo componente y fixture: **293 → 78 palabras visibles (−73%)**, incluida la etiqueta compacta de precio de captura. Escritorio y móvil sin desbordamientos ni errores JavaScript. Evidencia temporal: `product-browser/history-after-desktop.png` y `history-after-mobile.png`. El detalle conserva las 15 lecturas, fuentes, parámetros, hipótesis, confirmaciones, invalidaciones y bibliografía; exportación íntegra verificada. El resumen visible usa una oración completa y no recorta invalidaciones, que permanecen completas en el detalle. No se modificaron snapshots, histórico ni datos en DB. El contexto de mercado solo se consulta al solicitarlo con `context=1`; el enlace no hace prefetch y conserva los filtros del archivo.

Checks de esta iteración: 9/9 pruebas, incluyendo regresión de exportación completa y la identidad de un corte histórico. Tipos y lint correctos; la compilación con recursos reales se comprueba en Vercel. No se agregaron dependencias ni servicios.
