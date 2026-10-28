# Cloe — primera integración del espacio de análisis

Fecha: 28 de octubre de 2026 · Europe/Paris. Estado: vista previa, no versión final del producto.

## Encargo y resultado

Bruno pidió usar `BrunoCocco/CloeDashboard` como área de trabajo para reunir gráficos, información del dashboard y un espacio de investigación que pueda guardarse y exportarse. Esta entrega añade `/analisis` a la aplicación Next.js existente y un acceso desde el dashboard. La rama de revisión es `codex/analyst-workspace-preview`; producción permanece en `main`.

Se implementó una primera versión utilizable: siete activos, tres temporalidades por activo, indicadores calculados por la aplicación, notas, niveles horizontales compartidos, guardado local por usuario y exportaciones. No se presenta como terminada la sincronización en la nube ni la conservación de todas las preferencias gráficas.

## 1. Accesos comprobados antes de implementar

| Sistema | Evidencia | Conclusión |
| --- | --- | --- |
| GitHub | Repositorio CloeDashboard accesible, permisos pull/push/admin; clonación correcta | Se puede implementar y preparar una rama |
| Base Git | `main` en `154221a6c2a58fda66b571ebf447d77d0e88a7fe` al comenzar | Punto de partida conservado |
| Vercel | Proyecto `cloe-dashboard`, framework Next.js; producción READY `dpl_3VjuTJ2Z9ZyMYtk222ncoMAAaHvx` | Acceso a configuración y estado de despliegues |
| Entorno Vercel | Las dos variables públicas que necesita Supabase están asignadas a production, preview y development | No se cambiaron variables ni permisos |
| Google Drive | Lectura del documento central `00_LEEME_PRIMERO — Sistema Cloe`, bloque CI-3 | Marco vigente consultado; no se modificó |
| Supabase de CloeDashboard | Consulta directa al proyecto `wvwxwutjdqsktnrcdbkf` y `select current_database(), now()` rechazadas por permisos | El conector no permite auditar sus tablas en esta sesión |
| Supabase listado | Sólo aparece FuturosLab, inactivo, referencia distinta | No se confunde con la base del dashboard |
| Servicio Auth | Consulta de salud a la URL pública configurada devolvió 503 desde este entorno | Incidencia observada, causa no diagnosticada; no prueba por sí sola que la base esté inactiva |
| Pantalla actual | `/login` responde y el navegador muestra acceso privado sin sesión | La inspección del dashboard privado necesita una sesión válida |
| Kraken | AssetPairs confirmó siete mercados USD online; consultas OHLC 4H devolvieron series para los siete | Fuente disponible para la primera integración |
| Binance | Consulta de velas devolvió 451 por ubicación restringida | No se utiliza como fallback silencioso |

No se leyeron claves administrativas ni se cambiaron autenticación, políticas RLS o permisos. La configuración pública existente se preparó en un archivo local ignorado por Git.

## 2. Cambios técnicos, uno por uno

### Nueva sección privada

`src/app/analisis/page.tsx` valida la sesión con Supabase y reutiliza `loadDashboard(userId)`. Mantiene los módulos analíticos separados. Si falla la lectura del contexto, muestra el fallo sin sustituirlo por datos ficticios. No elimina ni reemplaza la vista principal ni las carteras.

### Motor de gráficos propio

Se incorpora `lightweight-charts` con versión fija `5.0.9` y lockfile. Se dibujan velas y volumen dentro de la aplicación, en lugar de utilizar el widget alojado de TradingView. Esto permite controlar series y niveles y preparar su persistencia. Se conserva la atribución de TradingView.

Sólo se montan los tres gráficos del activo seleccionado. Cambiar de activo reconstruye los gráficos a partir de su información guardada; no requiere recargar toda la página. El zoom y el desplazamiento todavía no se conservan.

### API propia de mercado

`GET /api/market/candles?symbol=BTC&frame=1D` valida sesión, activo y temporalidad. El servidor consulta exclusivamente un destino Kraken fijo; el cliente no puede indicar una URL arbitraria. Se contemplan sesión ausente, parámetros inválidos, timeout y fallo de proveedor.

La respuesta normaliza OHLCV y registra mercado, moneda, exchange, temporalidad, captura y discontinuidades. La consulta upstream tiene una caché de 60 segundos; la respuesta privada no se almacena públicamente. No hay streaming ni refresco automático continuo: hay carga al seleccionar activo y botón de actualización.

### Universo y procedencia

BTC, SOL, XRP, HBAR, XLM, VELO y SHX, todos Spot/USD de Kraken; BTC corresponde a XBTUSD. Esta elección cambia la referencia de BTC/SOL respecto de los widgets anteriores de Binance. No se atribuye un dibujo anterior al nuevo mercado ni se mezclan USD y USDT.

Kraken limita la profundidad del endpoint OHLC; se observaron hasta 721 entradas contando la vela abierta. Esta consulta no crea un archivo histórico continuo. Se muestran las fechas reales y los huecos detectados; la última vela se identifica como abierta según el contrato del proveedor.

### Indicadores

| Marco | Cálculo incorporado | Límite de esta entrega |
| --- | --- | --- |
| Semanal | VWAP trimestral naranja sin bandas; RSI14 sobre HL2 y suavizado EMA14; referencia rosa en 50 | VWAP calculado con HL2 y volumen diarios, muestreado por semana; no equivalencia exacta garantizada con otra granularidad |
| Diario | SMA20 sobre cierre; RSI14 sobre HL2 y EMA14; referencia rosa en 50 | Comparación numérica externa pendiente |
| 4 horas | Bollinger SMA20 ± dos desviaciones estándar poblacionales | Comparación numérica externa pendiente |
| Todos | Velas y volumen de la misma serie y mercado | Profundidad limitada por proveedor |

RSI usa el suavizado Wilder para ganancias/pérdidas; la EMA14 es una curva adicional sobre el RSI. HL2 significa `(high + low) / 2`, no cambiar las velas del gráfico. No se calculan valores antes de tener suficiente calentamiento. Un trimestre incompleto al inicio del histórico no produce un VWAP presentado como completo.

### Notas y niveles

Cada activo tiene notas independientes y hasta cien niveles horizontales, con precio y etiqueta. Los niveles se ven en las tres temporalidades del mismo activo; pueden añadirse con formulario o Ctrl + clic en el gráfico y quitarse individualmente.

Esto no es todavía una suite de dibujos: faltan tendencias, rectángulos, Fibonacci, anclajes tiempo/precio y edición con arrastre. Los dibujos guardados dentro de los antiguos widgets no se pueden importar mediante esta integración.

### Persistencia inicial

El espacio de trabajo se serializa como JSON versionado en localStorage, separado por identificador de usuario. Conserva activo seleccionado, notas y niveles después de cambiar de activo o recargar. El estado de guardado es visible y los fallos de almacenamiento se señalan. El guardado tiene un debounce de 300 ms y un intento adicional al evento pagehide. Si el JSON local está corrupto, se conserva su contenido en una clave de recuperación antes de iniciar un espacio vacío y se muestra un aviso persistente.

Local no significa nube: depende de este navegador y dispositivo; borrar su almacenamiento elimina esta copia. No se crearon tablas, permisos ni escrituras sobre el histórico analítico. La cuenta no sincroniza estos cambios entre dispositivos todavía.

### Exportación e importación

| Formato | Contenido | Recuperación |
| --- | --- | --- |
| JSON | Espacio de siete activos, notas, niveles y cortes disponibles de velas y síntesis | La importación valida versión, activos, tamaños y niveles; restaura el espacio editable, no reproduce las velas históricas como mercado actual |
| CSV | Velas consultadas del activo, tres marcos, mercado y fechas | Archivo de datos; no importador CSV en esta etapa |
| PNG | Captura de cada gráfico | Imagen; no contiene objetos editables ni equivale a un informe PDF |

La importación prepara un respaldo del espacio anterior antes de sustituirlo. El navegador puede solicitar permiso para varias descargas. El JSON incluye los cortes disponibles, no un archivo completo de todos los activos nunca consultados ni de toda la base del dashboard.

### Contexto fundamental y Fechas

La página reutiliza síntesis, macro y acontecimientos del lector del dashboard; evita mantener otra copia de esa lógica. Se muestra el último corte y se advierte que no implica una actualización de hoy. La información contextual no altera los indicadores técnicos.

No se cargaron datos financieros nuevos ni se reescribieron análisis. No se integraron todavía todas las tablas originales, fuentes documentales, noticias o series macro extensas. El corte exportado contiene la síntesis disponible, no todos los registros privados.

## 3. Verificación y límites de evidencia

IT verificó compilación Next.js, generación de tipos, TypeScript y lint. Las pruebas cubren validación y recuperación JSON, aislamiento de activos, rechazo de importaciones defectuosas, ejemplos numéricos independientes de indicadores, límites de calentamiento, reinicio trimestral y normalización de Kraken con huecos y datos inválidos. También se ejecuta la prueba previa del calendario.

Resultados: `npm run build`, `npx next typegen`, `npx tsc --noEmit` y `npm run lint` correctos. `node --test scripts/analysis-workspace.test.mjs scripts/dashboard-events.test.mjs`: ocho pruebas correctas, cero fallos.

La consulta real 4H de los siete mercados se comprobó desde el entorno de trabajo. Esto no prueba todas las combinaciones de proveedor, duración y dispositivo.

La revisión visual del producto privado está bloqueada por la falta de sesión autenticada. Se intentó servir un entorno aislado local sin cambiar la autenticación del producto; el navegador remoto no puede acceder al localhost del entorno de código. No se declara aprobada una revisión de canvas, colores, descarga real o diseño móvil sólo porque pase la compilación. Se ejecutó además una integración React DOM/jsdom aislada: tres paneles, notas independientes BTC/SOL, alta de niveles, guardado, desmontar/remontar recuperando notas y niveles, exportación JSON con contexto y recuperación de almacenamiento corrupto. Los canvas fueron sustituidos explícitamente por un componente de prueba; esto no verifica el motor gráfico. El script temporal se ejecutó desde `cloe-test-runtime/workspace-integration.cjs`, fuera del repositorio y sin añadir dependencias de prueba a la app.

No se verificaron tablas ni consultas autenticadas reales de Supabase mediante el conector, por falta de permisos. No se declara completada la integración en vivo de contexto privado.

## 4. Pendientes, en orden recomendado

1. **Revisión de la vista previa con sesión válida:** probar carga real de las tres temporalidades, colores, indicadores, niveles, recarga, PNG/CSV/JSON e importación. Confirmar escritorio y móvil; verificar que macro, Fechas y síntesis coinciden con el dashboard.
2. **Acceso a la base correcta:** resolver la autorización del conector a CloeDashboard y diagnosticar el 503 observado sin modificar seguridad a ciegas. Inspeccionar tablas y RLS antes de planear escrituras.
3. **Persistencia en nube:** diseñar tablas de espacios, notas, objetos de dibujo y revisiones por propietario, API de guardado validada, conflictos entre dispositivos y cola offline. No abrir escrituras sobre tablas analíticas administrativas para resolver el espacio editable.
4. **Paridad de indicadores:** contrastar resultados con una referencia independiente del mismo mercado y metodología; acordar la granularidad del VWAP y tratamiento de velas abiertas.
5. **Dibujos y preferencias completas:** tendencias, zonas y Fibonacci, selección/arrastre, deshacer/rehacer, color/grosor, zoom, rangos visibles y parámetros de indicadores; serialización versionada.
6. **Histórico continuo:** ingestión incremental de OHLCV, huecos, duplicados y límites de retención; conservar siempre fuente, mercado y revisiones. El endpoint actual no lo sustituye.
7. **Cortes de investigación recuperables:** guardar versiones inmutables con velas, notas, contexto macro y calendario completos y sus fuentes; separar corte histórico de espacio editable y de datos actuales.
8. **Exportaciones ampliadas:** PDF con gráficos y razonamiento, paquetes de investigación y restauración completa. Revisar derechos de redistribución de cada proveedor antes de ofrecer datos a terceros.
9. **Experiencia junior:** guía de lectura, glosario, preguntas de confirmación e invalidación y procedencia visible; sin decisiones automáticas ni probabilidades inventadas.
10. **Operación para varios usuarios:** aislamiento comprobado con dos cuentas, cuotas, rendimiento, respaldo, observabilidad, accesibilidad y política de conservación.

## 5. Arquitectura de la siguiente etapa

La API propia es una capa del mismo proyecto Next.js: no exige crear otro repositorio o servidor separado. Next.js puede servir interfaz y endpoints; Supabase conserva identidad, datos y permisos. El motor gráfico es independiente y recibe series normalizadas. El contexto fundamental usa los registros existentes y mantiene su procedencia.

La prioridad siguiente es cerrar un flujo verificable: abrir BTC, anotar, añadir nivel, exportar, recargar y recuperar el mismo trabajo; después sincronizarlo entre dos dispositivos con autorización por propietario. La publicación definitiva no debe confundir un despliegue READY con estas verificaciones de comportamiento.

## 6. Incidencia de acceso y corrección preparada

Bruno informó que no puede entrar por el login. Las comprobaciones directas del endpoint Auth `/auth/v1/health` y de REST `/rest/v1/` del proyecto configurado devolvieron HTTP 503, con un fallo de conexión upstream, desde el entorno de trabajo. El conector siguió rechazando `get_project` y la consulta SQL al proyecto CloeDashboard por permisos. Esto no permite determinar si la causa es pausa, infraestructura o acceso; tampoco permite actualizar ni verificar tablas. **No se actualizó Supabase y no se declara resuelto el ingreso.**

Se detectó y corrigió un problema de manejo de errores de la app: login y registro mostraban el mismo mensaje genérico ante fallos de servicio y no capturaban excepciones de red. Ahora distinguen servicio no disponible, límite de intentos, credenciales rechazadas y correo no confirmado usando códigos/estado del SDK; no muestran detalles internos ni atribuyen un 503 a una contraseña incorrecta. Los redirects exitosos se mantienen fuera del bloque de captura para no convertirlos en errores.

El proxy de sesión captura fallos de verificación: permite mostrar la página pública de acceso y mantiene bloqueado el contenido privado. Una identidad sólo es válida si hay `sub` no vacío y ninguna devolución de error. No se desactivó autenticación, no se cambiaron claves, cuentas, contraseñas ni políticas RLS. El mínimo previo de ocho caracteres sigue vigente: no hay evidencia de que sea el motivo del problema de Bruno.

Verificación de esta corrección: build Next.js, TypeScript y lint correctos; suite combinada de dieciséis pruebas correcta, cero fallos. Las nuevas pruebas de regresión usan respuestas simuladas explícitas, sin credenciales de usuarios: HTTP 503, 429, excepciones de red, distinción de credenciales y confirmación, redirect exitoso, fallo de registro y protección de rutas ante verificación fallida. No equivalen a un inicio de sesión real contra Supabase. Pendiente: recuperar disponibilidad y acceso administrativo al proyecto correcto; luego comprobar login con una sesión autorizada, lecturas del dashboard y sólo entonces planificar una actualización de datos/esquema trazable.
