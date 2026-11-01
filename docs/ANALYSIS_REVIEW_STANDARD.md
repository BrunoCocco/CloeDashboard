# Estándar de revisión de capturas CLOE — versión 1.0

Este estándar conserva información, interpretación y condiciones de revisión sin convertir el análisis en órdenes. Aplica a nuevos cortes; no reescribe el histórico legacy. El protocolo general `CLOE_UPDATE_PROTOCOL.md` sigue vigente para los módulos independientes.

## Contrato del corte

- Identificar activo, par, exchange, moneda, mercado spot/derivado o desconocido y temporalidades realmente visibles.
- Separar día del análisis, hora observada de mercado, hora atribuida a captura y fecha real de registro. Una hora inferida del nombre de archivo se etiqueta `filename-derived`; nunca verifica una cotización ni se copia como hora observada. Si no se conoce un dato, conservar `null` y explicar el límite.
- Registrar procedencia y, cuando esté disponible, huella SHA-256 de la evidencia; no publicar capturas privadas, identificadores personales ni ubicaciones privadas en el repositorio.
- Separar hechos transcritos, estimaciones y desconocidos de la interpretación. Vincular hipótesis a los identificadores de evidencia; mostrar valores, unidades y parámetros realmente visibles. No heredar configuración por defecto de otro gráfico.
- Analizar las temporalidades realmente visibles (incluida 1H), sin mezclar sus ejes. Si no puede atribuirse una anotación a un marco con certeza, indicar marco desconocido. Señalar contradicciones multitemporales, vela bajo cursor/abierta/cerrada y falta de OHLCV cuando corresponda.
- Comparar amplitudes de movimientos como observación. Un dibujo de proyección no confirma un pronóstico ni su probabilidad. RSI 50 de referencia no equivale a RSI actual; suavizado no confirma método; VWAP Year no se reemplaza por trimestre.
- Exponer interpretación, hipótesis, escenarios contrarios, confirmaciones e invalidaciones. Wyckoff/divergencias requieren evidencia suficiente; no asignar fases ni sobreventa sin base. No usar probabilidades numéricas sin método validado.
- Distinguir bibliografía efectivamente consultada durante el corte de marcos conceptuales. No afirmar lectura de libros o documentos no consultados.
- Fundamental, Fechas y Técnico mantienen sus fuentes y cortes independientes. Una captura técnica no actualiza automáticamente los otros módulos ni la cotización viva.
- La falta de datos queda como insuficiencia. CLOE no produce órdenes, gestión de capital ni decisiones automáticas.

## Histórico y correcciones

`analysis_review_snapshots` conserva un JSON versión1/estándar1.0 por corte. El orden del archivo es `analysis_date DESC, created_at DESC, id DESC`: primero el día de análisis y, dentro de él, el momento real de registro. La hora observada se muestra por separado y puede ser desconocida. Un backfill de un día anterior no desplaza un análisis de un día posterior. El histórico usa páginas de 20 y cursor de esas tres columnas; no un desplazamiento que cambie al insertar filas nuevas.

Cada ingreso tiene `ingestion_key` estable por propietario y corte. Un reintento reutiliza esa clave y `ON CONFLICT (user_id, ingestion_key) DO NOTHING`. Un nuevo análisis o corrección recibe clave nueva; dos análisis diferentes pueden partir de la misma imagen. La clave no debe contener datos personales. `created_at` se estampa en DB con la hora real de inserción.

Una corrección es una fila nueva con `revision_of` apuntando a un corte del mismo propietario. No se modifica ni borra el original. UPDATE, DELETE y TRUNCATE están bloqueados por triggers; un administrador capaz de alterar/eliminar el esquema puede superar estos controles y necesitaría un procedimiento autorizado. Las referencias al propietario no se eliminan automáticamente con la cuenta: una futura solicitud de borrado requiere un procedimiento específico, no desactivar controles silenciosamente.

Los resultados posteriores deben ser eventos nuevos con fecha, evidencia, relación con el corte y estado de confirmación/invalidación; no reemplazar la hipótesis original. **La tabla/UI de evaluación de resultados queda pendiente en esta versión.** No se registran resultados ficticios ni se afirma seguimiento automático.

## Ingesta administrativa y permisos

El lector autenticado solo consulta filas propias por RLS; no se habilitan escrituras desde el navegador. No hay automatización desde conversaciones, Gateway ni carga automática del ejemplo. Un administrador autorizado debe validar con `parseReviewSnapshot`, comprobar identidad/fecha/fuentes y usar una inserción parametrizada en la DB correcta de CloeDashboard:

```sql
insert into public.analysis_review_snapshots
 (user_id, ingestion_key, asset_symbol, analysis_date, observed_at, revision_of, snapshot)
values ($1, $2, $3, $4, $5, $6, $7::jsonb)
on conflict (user_id, ingestion_key) do nothing
returning id, analysis_date, observed_at, created_at;
```

Después se verifica SELECT con el usuario propietario, orden, detalle, RLS de otro usuario y visualización autenticada. No basta con insertar. El SQL de referencia en `docs/sql/analysis-review-snapshots.sql` fue aplicado en CloeDashboard mediante una migración de Supabase el 2026-10-30; su verificación y límites se registran en `ANALYSIS_HISTORY_PREVIEW_REPORT.md`. No volver a aplicar ese DDL sobre la tabla existente. Para cambios futuros, antes de generar/aplicar otra migración: confirmar proyecto, inspeccionar esquema real, crear el archivo mediante `supabase migration new`, revisar la migración, ejecutar pruebas/advisors y comprobar la pantalla. Nunca usar la DB del proyecto Graficoxrp para este archivo.

## Ejemplo de validación BTC

`src/data/btc-review-example.ts` es una transcripción de prueba autorizada, no una fila real ni una cotización actual. Se muestra separadamente en `/analisis/ejemplo`, protegida por sesión. Tiene día 2026-10-30, hora atribuida al archivo y hora de mercado nula. Su fecha de registro es nula porque no se insertó. Descargar JSON preserva la marca `example:true`. No incluir imagen ni identificadores privados en Git.

## Proceso acumulativo de captura y comparación · aprobado 31/10/2026

Cada captura analizada se incorpora como un nuevo corte administrativo idempotente, después de validar el contrato. Recuperar primero de DB el corte previo del mismo propietario y activo; conservar su ID y fecha en la interpretación comparativa. La carga nueva no sustituye el original ni cambia sus hipótesis.

1. Identificar fuente y hash, día del análisis, marcos visibles, datos transcritos/estimados/desconocidos y horas verificadas o nulas. El cursor puede mostrar una vela histórica: diferenciar sus valores de las etiquetas del extremo derecho.
2. Comparar solo magnitudes compatibles; expresar diferencias entre capturas, nunca retornos de 24 horas sin timestamps verificables. Un cambio de nivel dibujado no prueba desplazamiento del mercado. No comparar Bollinger de 4H con 1H como evolución del mismo indicador. Cambios de parámetros o fuente limitan comparabilidad.
3. Guardar síntesis histórica compacta en la primera interpretación (visible), y debajo detalle de comparación, referencia del corte anterior, hipótesis conservadas, novedades y condiciones pendientes. El detalle y la exportación conservan toda la evidencia disponible.
4. No dar un escenario anterior por cumplido o invalidado por dos fotografías. Registrar «sin evaluación concluyente» cuando falten trayectoria, cierres y volumen. Las evaluaciones formales de resultados siguen pendientes de su tabla/UI; no simularlas.
5. Insertar sin UPDATE/DELETE, verificar lectura por propietario, orden del último corte, conservación del previo y representación del componente. Si no puede comprobarse la sesión privada desplegada, informar el límite. Fundamental y Fechas mantienen su propio corte.

Este es un procedimiento de trabajo autorizado al solicitar análisis/carga; no un servicio automático entre conversaciones ni una ingesta programada de capturas.

## Carga por defecto tras cada análisis · instrucción 01/11/2026

Bruuno autoriza y solicita que, al terminar cada análisis de mercado de Cloe, se cargue el corte correspondiente al dashboard sin esperar otro pedido. Aplicar esta regla dentro de la misma tarea: validar el registro, recuperar el previo, insertar de forma idempotente sin reemplazar el histórico y comprobar lectura por propietario y orden del último corte. La presentación prioriza escenario desarrollado, interpretación de mercado y niveles útiles; los controles técnicos quedan en el registro/exportación. Si faltan datos, conservar la incertidumbre; si falla la carga o no se puede comprobar la pantalla privada, informarlo explícitamente. No presentar solo una respuesta en chat como carga completada. Esta autorización no crea un servicio autónomo, ni cambia reglas de seguridad, gestión u operaciones.
