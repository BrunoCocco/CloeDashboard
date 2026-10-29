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

## 7. Evolución: fundamental por activo y DATOS MERCADO

El trabajo continúa en una única rama de avances, `codex/cloe-evolucion`. Se conecta el panel fundamental al selector existente: BTC muestra su análisis específico; SOL muestra el suyo, y así para los siete activos, sin recargar la página. Se conservan las notas, los niveles y las exportaciones anteriores.

Se separa expresamente **DATOS MERCADO**, con macro, calendario y síntesis general del dashboard. Este bloque conserva su alcance general al cambiar de activo; no se reclasifica como tesis de la moneda seleccionada ni modifica los indicadores técnicos.

### Datos compatibles con el esquema real del repositorio

La tabla `fundamental_analyses` documentada no tiene `asset_id` ni `symbol`. No se añadieron consultas a columnas inexistentes ni se aplicaron migraciones. El lector acepta únicamente bloques explícitos dentro del JSON `evidence` existente, mediante este contrato para futuras cargas administrativas:

```json
{
  "scope": "asset",
  "symbol": "BTC",
  "summary": "Resumen específico del activo, redactado a partir de evidencia",
  "as_of": "2026-10-28T09:00:00Z",
  "hypothesis": "Hipótesis separada de los hechos observados",
  "regime": "neutral",
  "evidence": [
    {
      "text": "Hecho documentado del activo",
      "as_of": "2026-10-27T12:00:00Z",
      "source": {"name": "Nombre de la fuente", "url": "https://example.org/fuente"}
    }
  ],
  "risks": ["Riesgo específico documentado"],
  "opportunities": ["Oportunidad específica documentada"],
  "sources": [{"name": "Nombre de la fuente", "url": "https://example.org/fuente"}]
}
```

Este ejemplo describe estructura, no contiene investigación ni datos financieros actuales. Los bloques van en el array `evidence` de un registro fundamental del propietario; el resumen principal del registro mantiene su función general. `confidence`, si se aporta, debe ser un número de 0 a 100 declarado para ese bloque; no se hereda del análisis general.

El lector filtra primero por propietario y por contención JSON `{scope: "asset", symbol: "BTC"}`, después ordena por `as_of` del registro y toma el último. Hace consultas independientes para cada activo: muchos registros de SOL no esconden el último BTC. Una mención casual de BTC en texto macro no se convierte en un análisis de BTC. Si hay varios bloques válidos del mismo activo en el registro elegido, se prioriza su fecha explícita. Sin fecha del bloque, la pantalla identifica claramente que se usa el corte del registro.

La pantalla distingue falta de análisis y fallo de consulta; muestra resumen, hipótesis, evidencia, fuentes, riesgos, oportunidades y confianza sólo cuando están documentados. Las URLs de fuentes admiten únicamente HTTP/HTTPS. Los campos ausentes se marcan sin información, no se completan a partir del macro.

### Noticias propias del activo

También se consultan hasta tres entradas de `news_items`, filtradas por propietario, `affected_assets` exacto y estado `official` o `corroborated`, ordenadas por fecha de publicación. Se muestran su fuente, fecha y estado. Son noticias del histórico propio, no un servicio de noticias en tiempo real ni una tesis generada automáticamente. Si falla la lectura de la tesis, las noticias pueden seguir disponibles de forma independiente.

### Guardado y comprobaciones de esta entrega

El JSON exportado incorpora el fundamental y las noticias del activo seleccionado dentro de `contextSnapshot.assetFundamental`, con identidad y corte. Restaurar el archivo sigue recuperando sólo el espacio editable; no convierte este snapshot histórico en información actual ni reemplaza datos del servidor.

Compilación Next.js, TypeScript y lint correctos; suite combinada de veintidós pruebas correcta, cero fallos. Se añadieron pruebas de contrato explícito frente a menciones macro, ausencia de herencia de confianza/régimen, saneado de fuentes, fechas, noticias verificadas, aislamiento por propietario y selección por activo antes del límite. La integración React DOM aislada comprueba selector BTC→SOL, panel específico y snapshot exportado sin mezclar activos, además de las regresiones previas de notas, niveles y recuperación local. El canvas continúa sustituido por un fixture en esa prueba; no es una revisión visual del gráfico.

No se cargó investigación nueva, no se escribieron tablas ni se declaró que los bloques específicos existan ya en la base viva. La auditoría directa de tablas continúa pendiente del permiso del conector al proyecto correcto. El estado de Auth se recuperó a respuestas HTTP 200 en salud/configuración según la comprobación posterior del coordinador; esto no prueba un login real ni el contenido privado. Pendiente: verificar con sesión válida los análisis y noticias realmente cargados y completar las cargas administrativas específicas con fuentes y cortes.

## 8. Capturas revisadas e histórico local en vista-graficosxrp

Se mantiene la rama `vista-graficosxrp` y su disposición de tres widgets. Una barra compacta abre un cuaderno modal; abrirlo, cerrarlo o guardar no desmonta los gráficos visitados ni sus dibujos en la sesión. La persistencia de esos dibujos después de recargar sigue fuera del alcance del widget alojado. Cerrar y volver a abrir el cuaderno retoma el borrador en memoria sin borrar captura o notas ni reasignar el activo. Nuevo corte pide confirmación antes de descartar un borrador con contenido.

Flujo incorporado: capturar una pestaña con permiso del navegador o cargar PNG/JPEG/WebP → revisar la previsualización → corregir ficha de activo, exchange, par y temporalidad → añadir observaciones, hipótesis e invalidación → confirmar niveles manualmente y revisión final → guardar un corte nuevo → consultar el histórico y abrirlo en sólo lectura → exportar PNG o JSON con imagen y procedencia. La identidad sugerida del selector se puede corregir porque el usuario puede haber cambiado el símbolo dentro de un widget.

La solicitud de captura se inicia directamente desde el gesto del botón. El cuaderno se oculta antes de tomar el frame y todos los tracks se detienen al terminar o fallar. Hay espera de frame y timeout. La alternativa de carga permanece disponible cuando el navegador no ofrece captura. Las imágenes se decodifican, comprueban por formato/firma, tamaño y dimensiones, y normalizan a PNG: máximo 12 MB, 8192 píxeles por lado y 20 megapíxeles. La previsualización permite revisar qué se guardará.

La fecha de guardado se registra siempre. La captura en la app tiene fecha propia; una imagen importada conserva `capturedAt: null`. La fecha de observación no se inventa: es un campo opcional informado por el usuario. Los cortes no se presentan como cotizaciones actuales ni como lectura automática del mercado.

### Lectura asistida real, con límites explícitos

Se integra Tesseract.js `6.0.1` de forma diferida. Al pulsar OCR, el navegador descarga motor, worker y modelo públicos y procesa la imagen localmente; no se envía la captura a un servicio de visión. Hay cancelación y límite de 90 segundos; fallos de descarga o reconocimiento permiten continuar manualmente. Se desechan resultados si cambia la imagen y cualquier nuevo texto OCR invalida la revisión anterior.

OCR extrae texto, no interpreta dibujos, líneas o velas. Los candidatos numéricos conservan el token original, incluidos separadores ambiguos. Nunca se convierten automáticamente en soporte o resistencia. El usuario debe corregir precio, clasificarlo, etiquetarlo y confirmar cada nivel. La interfaz muestra la interpretación del campo con punto decimal antes de confirmarlo. No hay API de IA ficticia ni afirmaciones de lectura visual integral.

### Archivo y exportación

IndexedDB conserva metadatos e imágenes Blob en stores separados mediante una misma transacción; no se guardan imágenes grandes en localStorage. Las claves e índices incluyen el propietario. Las consultas y reaperturas se limitan a ese usuario y pueden filtrarse por activo. Se muestran hasta los últimos 100 cortes de cada filtro sin borrar los anteriores. `add`, en lugar de reemplazo, impide sobrescribir un corte existente. Los errores de apertura, permiso o escritura se muestran y no se declara guardado antes de completar la transacción.

El archivo es local, no está cifrado y depende del navegador y dispositivo. No se sincronizó ni migró Supabase. El JSON exportado contiene la imagen PNG en data URL, ficha, texto OCR revisable, niveles confirmados y fechas diferenciadas; omite el identificador interno del propietario. El PNG puede exportarse también antes de guardar como respaldo de la imagen.

### Verificación y pendientes

Verificación: compilación Next.js, TypeScript y lint correctos; 27 pruebas correctas en la suite combinada. Pruebas nuevas: preservación de tokens ambiguos, rechazo de niveles no confirmados o inválidos, revisión obligatoria, fechas opcionales sin inventar, formatos/firmas/tamaño/dimensiones, persistencia de metadatos e imagen, aislamiento de propietario/activo y atomicidad al intentar un duplicado.

Prueba aislada React DOM con fake-indexeddb: carga y previsualización con decoder simulado, texto OCR simulado, confirmación de nivel, guardado, histórico de sólo lectura, reapertura después de desmontar/remontar, exportaciones y conservación de widgets montados. También se simulan captura y rechazo de permiso; se comprueba que la solicitud ocurre en el gesto y que los tracks se detienen aunque falle la normalización. Estas simulaciones no prueban la captura del sistema ni el canvas real del navegador.

El coordinador comprobó además OCR real en Node con una imagen sintética propia de texto conocido y reconocimiento del número `12345.67`. No usó una captura del usuario. Los tres assets exactos del wrapper (worker 6.0.1, core 6.0.0 y modelo eng 4.0.0) respondieron HTTP 200 desde el entorno de trabajo. Eso no verifica la carga del worker ni el OCR de extremo a extremo en el navegador del usuario. La prueba visual autenticada, los permisos de captura del navegador y el reconocimiento de gráficos reales siguen pendientes.

Siguientes mejoras recomendadas: recortar y ampliar un gráfico antes del OCR; comparar corte A/B conservando hipótesis e invalidación originales; registrar qué evidencia posterior confirmó o contradijo la lectura, sin reescribir el pasado. Después, sincronización por propietario y respaldos en nube con esquema y RLS verificados. No se añaden decisiones automáticas ni ejecución de operaciones.

## 9. Lectura estructurada del widget completo — API no activa

Se añade una lectura de toda la captura, hasta tres paneles, con ficha de activo/exchange/par/temporalidad, referencia de vela, precio mostrado, OHLC, volumen, indicadores dinámicos con parámetros y valores, y marcas con puntos o rangos estimados. Cada campo conserva valor, unidad, origen (`visible`, `estimated`, `unreadable`), confianza cualitativa, motivo y evidencia visible. Los desconocidos deben ser `null`, origen ilegible y confianza nula. No se copian como observados los parámetros programados de TradingView ni se calculan indicadores sin su serie.

La referencia OHLC puede ser una vela histórica bajo el cursor, no una cotización actual; RSI 50 puede ser una línea central y no el valor del RSI. Las marcas estimadas permanecen separadas de los niveles que el usuario confirma manualmente. La interfaz muestra etiquetas legibles en español y conserva los nombres canónicos para exportación.

### Ya operativo sin proveedor de visión

El cuaderno permite descargar una plantilla **sin resultados**, adjuntar captura y plantilla a una herramienta de lectura externa elegida por el usuario, e importar o pegar el objeto de lectura devuelto. La app valida su estructura y exige revisión humana; no declara que la lectura externa haya sido verificada con un proveedor. El JSON debe contener `schemaVersion`, `panels` y `limitations`; los indicadores incluyen `name`, `params: [{name, reading}]` y `values: [{label, reading}]`. El ejemplo descargable detalla el formato y mantiene todos los valores no leídos en null.

Se muestran debajo las tablas completas por panel, incluidos indicadores, parámetros, valores y marcas, con evidencias y limitaciones. El editor JSON permite corregir y validar; los cambios invalidan la revisión previa. Un JSON pendiente impide guardar un corte ambiguo, y la acción de descartar restaura la última lectura validada sin bloquear el guardado de la captura. Durante una solicitud de visión se bloquean ediciones que podrían sobrescribirse; una solicitud fallida no genera datos de reemplazo ni impide seguir manualmente.

Exportaciones: JSON de lectura, CSV aplanado (panel, campo, valor, tipo, unidad, origen, confianza, motivo, evidencia) y JSON completo del corte con imagen. CSV protege fórmulas introducidas como texto y conserva valores numéricos negativos, como MACD. El snapshot local añade `widgetReading` opcional: los cortes V1 anteriores siguen funcionando sin migrar IndexedDB y muestran que no conservan lectura estructurada.

### Integración de servidor preparada y deshabilitada

Se incorpora AI SDK `7.0.155` y Zod `4.6.7`, con documentación y código de la versión instalada revisados. El proveedor se carga sólo en el servidor y de forma diferida, usando `generateText` y `Output.object`. El prompt trata la imagen como datos no confiables, ignora instrucciones escritas dentro de ella, exige evidencia visible, distingue estimaciones y prohíbe rellenar parámetros por defecto, navegar URLs o dar órdenes de inversión.

`GET /api/captures/vision` devuelve estado privado; `POST` requiere sesión válida, usuario autorizado, configuración completa, origen de solicitud permitido y consentimiento explícito de envío. El endpoint acepta únicamente bytes PNG, nunca URLs ni destinos elegidos por el cliente: máximo 3 MB, firma PNG y dimensiones acotadas. Las imágenes locales originales se conservan; si superan 3 MB, se solicita recortar o reducir una copia antes de enviar. La respuesta requiere estructura válida y revisión humana.

**No se habilitó la API, no se configuraron claves/modelos/usuarios y no se invocó ningún proveedor real ni se autorizaron costes.** Sin configuración completa, el servidor no importa ni llama al proveedor y el botón de visión está deshabilitado honestamente. Importación, revisión, histórico y exportación siguen disponibles.

Para una activación futura autorizada, configurar exclusivamente en el servidor:

- `CLOE_VISION_ENABLED=true`, sólo después de aprobar proveedor y coste.
- `VISION_MODEL`: identificador exacto vigente `proveedor/modelo`, comprobando soporte de imagen y salida estructurada en el catálogo actual. No hay un modelo predeterminado.
- `AI_GATEWAY_API_KEY`: credencial gestionada por el mecanismo seguro del proyecto; nunca introducirla en conversación, cliente o repositorio.
- `CLOE_VISION_USER_IDS`: lista explícita de usuarios autorizados al piloto. Una cuenta nueva o un token OIDC ambiental no habilita llamadas.

El consentimiento por imagen muestra Vercel AI Gateway y el modelo de destino. La integración usa máximo 10000 tokens de salida, cero reintentos y un timeout de proveedor de 45 segundos (55 en cliente). No escribe imágenes en logs de la aplicación y desactiva la telemetría de contenido del SDK. Antes de activar deben revisarse presupuesto, retención y registros propios del Gateway/proveedor, además de cuotas por usuario: aún no hay un rate limiter distribuido. Las variables del ejemplo quedan deshabilitadas y sin valores secretos.

### Evidencia y límites

Compilación Next.js, TypeScript y lint correctos; suite combinada de 37 pruebas correcta. Pruebas nuevas cubren tres paneles e indicadores arbitrarios, unidades/valores negativos, origen y desconocidos, rechazo de fuentes inconsistentes, importación etiquetada, CSV y fórmulas, configuración obligatoria, ausencia total de importación/llamada al proveedor cuando está deshabilitado, autenticación y lista de usuarios, consentimiento/origen/formato/límite de carga, una respuesta de proveedor simulada y compatibilidad del histórico V1 con lecturas nuevas.

La integración React DOM/IndexedDB con fixtures comprueba importar una lectura de tres paneles, ver indicadores, invalidar la revisión, recuperar un JSON inválido descartándolo, guardar/reabrir con lectura y exportar el conjunto con imagen. El botón de visión permanece deshabilitado en el fixture sin configuración. No se probó visión real sobre capturas ni se declara fiabilidad de extracción de valores o marcas: esa validación queda pendiente de autorización y del piloto con imágenes reales revisadas.

## 10. Lectura geométrica local revisable — 2026-10-29

Se completa una primera vertical sin servicio de visión remoto: captura/carga → detección de candidatas → selección explícita de una región de precio → calibración manual con dos alturas y precios → revisión → guardado local y reapertura. El endpoint remoto conserva GET `disabled_local_only` y POST 503; no se modificaron claves, configuración, autenticación, Supabase ni permisos, y no se ejecutaron solicitudes al Gateway.

La superposición SVG usa las dimensiones originales de la imagen. El usuario elige dos esquinas del panel y dos alturas de precio por toque/clic o coordenadas editables, y declara escala lineal o logarítmica. Se valida el orden del eje, precios positivos, separación de puntos y límites de imagen. Esta versión admite **una región/panel por corte**: no mezcla automáticamente los ejes de tres gráficos ni el precio con RSI o volumen. Se puede crear otro corte para otro panel.

Las líneas de esa región obtienen precios **estimados** mediante la calibración, no mediante OCR ni datos del mercado. Cada candidata permite clasificación humana como referencia, soporte o resistencia y decisión pendiente/aceptada/descartada. Ninguna clasificación se confirma automáticamente; las confirmaciones se conservan dentro de `localReading`, separadas de los niveles manuales independientes para evitar inserciones duplicadas. Recalibrar inicia decisiones nuevas y elimina las anteriores de esa lectura. Un resumen explicable muestra conteos y rango estimado revisado, sin deducir tendencia, señales, OHLC ni indicadores. La lectura estructurada importada/revisada y el texto OCR existentes siguen disponibles por separado.

`CaptureMetadata` incorpora `localReading` opcional y versionado, con región, puntos, escala, geometría, precios estimados, decisiones y resumen del corte. Se conserva en IndexedDB y JSON completo junto con la captura, sin cambiar la versión de la base ni invalidar registros históricos. La reapertura muestra superposición, resumen y tabla en modo de consulta. También se conservan las candidatas sin calibrar: geometría y decisiones pendientes/descartadas, con precios nulos y sin posibilidad de aceptar un nivel hasta aplicar la calibración. No se añadió un CSV geométrico específico en este corte. Aplicar/descartar una calibración pendiente y terminar la detección son requisitos para guardar/exportar, y las ediciones anulan la revisión final. La detección asíncrona descarta resultados de imágenes anteriores.

Se corrigió el contraste del detector para trazos luminosos de varios píxeles y se agruparon bordes próximos. Sigue siendo experimental: líneas oscuras, cuadrículas, marcos y elementos de interfaz pueden requerir revisión; no existe garantía general de exhaustividad o precisión. No se añadió una lectura automática del eje ni interpretación semántica por píxeles.

Verificación de esta implementación: `npm run build`, `npx tsc --noEmit`, `npm run lint` y `node --test scripts/*.test.mjs`: **54/54 pruebas correctas**. Se actualizaron expectativas antiguas del endpoint para comprobar que ni configuración, identidad ni consentimiento lo reactivan. Las ocho pruebas nuevas cubren interpolación lineal/logarítmica, errores y región, recalibración, trazos de 2–6 px y cuerpos de velas, persistencia/reapertura/exportación serializable, aislamiento por propietario y registros sin `localReading`. Además se decodificó con Pillow el PNG sintético semilla de `scripts/fixtures/line-recovery.json`: el detector encontró las tres líneas dibujadas como tres candidatas; esta comprobación no equivale a precisión general ni a una prueba de captura real en navegador.

La revisión React comprobó estado derivado, invalidación de revisiones, ausencia de lecturas de refs durante render, límites de efectos y alternativas de teclado. Las pruebas anteriores y el build no acreditan por sí solos una sesión autenticada de producción ni el flujo real de captura del navegador. La evidencia visual adicional, si se obtiene, debe registrarse separadamente con sus condiciones. Pendientes: múltiples regiones por corte, calibración asistida por OCR con revisión, exportación CSV geométrica y evaluación sobre capturas reales con distintas escalas/resoluciones.

Verificación adicional comunicada y revisada por el coordinador: **navegador real Chrome 153**, componente original compilado con esbuild en un harness local aislado (sin iniciar sesión ni saltar la autenticación de la app). Se cargó el PNG sintético de 1500×1000, el canvas produjo tres candidatas, se calibró ROI (55,330)–(1366,791) con 110 en y422 y 95 en y698, se aceptaron dos niveles con clasificación humana y se descartó uno. Guardar → recargar realmente el navegador → histórico conservó resumen, calibración y decisiones; exportar JSON conservó imagen y `localReading`. La revisión de escritorio y de viewport móvil 390×844 no mostró desbordamiento horizontal del diálogo; cero errores JavaScript y cero solicitudes externas en ese flujo aislado. Evidencia temporal del coordinador: `cloe-browser-check/flow.mjs`, `desktop-reading.png`, `mobile-reading.png` y `capture-export.json` fuera del repositorio. Esta prueba **no** acredita captura de pantalla del sistema, login, widgets TradingView reales ni integración autenticada del despliegue.

Tras esa revisión se limita la presentación de precios estimados a aproximadamente seis cifras significativas, con prefijo `≈`, tanto en tabla como en resumen guardado. Los valores numéricos originales de geometría/calibración/estimación se preservan en JSON. No se presenta precisión decimal ficticia como precio observado.

## 11. Autocompletado local de etiquetas de precio — 2026-10-29

La calibración de dos puntos deja de ser el paso obligatorio. Al aceptar una captura o imagen nueva, se detectan las líneas y se inicia **una lectura OCR local automática** de las etiquetas del costado derecho. El usuario ve los precios recuperados en la tabla, revisa el texto original y confirma o descarta cada nivel. Una línea sin etiqueta legible conserva precio nulo: no se rellena desde otra línea ni desde precios esperados. La corrección individual de precio y la calibración lineal/logarítmica siguen disponibles como alternativas. No se añadieron cálculos de indicadores, OHLC, señales ni clasificación automática de soportes/resistencias.

Implementación: Tesseract.js 6.0.1, worker 6.0.1, core de navegador 6.0.0 y modelo inglés 4.0.0 ya fijados. Se solicita `blocks` explícitamente para obtener palabras, confianza y bounding boxes; el recorte derecho conserva offsets y factores de escala para devolver coordenadas de imagen original. El pase general PSM11 se complementa con un pase PSM7 sobre badges coloreados detectados a la derecha del extremo de cada línea. Sus límites salen de los píxeles reales, no de las coordenadas ni valores esperados de la fixture. Se recorta el interior del badge y se normaliza el contraste a texto negro sobre fondo blanco. Un único worker procesa ambos pases; el texto de mayor confianza sustituye una copia coincidente menos clara. Este tratamiento fue necesario porque el pase general ignoraba algunos badges coloreados.

La asociación usa proximidad vertical acotada y posición respecto al extremo derecho, sin reutilizar una etiqueta para varias líneas. Empates cercanos quedan sin resolver. Los tokens con hora, fecha, porcentaje o sufijos de volumen no se interpretan como precios. Se aceptan notaciones decimales inequívocas, incluidos `0.052` y `0,052`, y separadores mixtos válidos; `70.000`/`70,000` quedan ambiguos. Confianza OCR menor a 65 conserva evidencia pero no autocompleta un precio. La confianza del motor nunca se presenta como verificación de mercado.

La captura conserva `localReading` compatible con los registros anteriores y añade opcionalmente el escaneo, palabras originales, bbox, confianza, procedencia `ocr-label`, preprocesamiento y asociación con la candidata. Una corrección manual conserva el OCR original por separado; un reintento no sustituye correcciones ni decisiones existentes. La tabla y el resumen distinguen precio OCR, corrección humana y estimación por calibración. Solo las estimaciones geométricas llevan `≈`; los números originales siguen en JSON. Recalibrar preserva la evidencia OCR y recupera la geometría original, sin arrastrar un recorte anterior. Guardar, reabrir y exportar mantienen esta información sin cambios de versión de IndexedDB ni migraciones de Supabase.

La lectura tiene cancelación, timeout de 90 segundos, descarte de resultados de imágenes anteriores y reintento explícito. No se ejecuta por cada renderizado, guardado o apertura de un corte histórico. Mientras trabaja se pide esperar o cancelar antes de guardar; ante un fallo la imagen y las notas permanecen disponibles y la revisión manual sigue siendo posible. Solo se descargan los recursos públicos del motor: las imágenes permanecen en el navegador. No se modificaron claves, autenticación, permisos ni configuración; la visión remota sigue desactivada y su endpoint conserva POST 503.

Verificación de código: build, TypeScript, lint y suite completa **66/66 pruebas correctas**. Se añaden pruebas de separadores, distancias y correspondencia única, líneas sin etiqueta, baja confianza, no sobrescritura, preservación al calibrar, persistencia y aislamiento por propietario, badges genéricos y cruces de velas. Las pruebas del wrapper con worker simulado se identifican como tales: verifican opt-in de bloques, transformación de coordenadas, cancelación y terminación del worker; no sustituyen la siguiente comprobación del motor real.

Verificación real comunicada por el coordinador: Chrome empaquetado, componente original en harness local aislado, Tesseract WASM real y bytes exactos de sus tres recursos públicos servidos desde caché de prueba. La fixture reproducible `scripts/fixtures/axis-labels.json` (generador `scripts/generate-axis-label-fixture.py`) produjo tres candidatas y autocompletó `104.25`, precio nulo y `101.5`, **sin calibración ni introducción manual de esos precios**. La línea sin etiqueta no permitió aceptar un nivel. Confirmar las dos lecturas → guardar → recarga real → histórico → exportación mantuvo imagen, raw OCR, bbox, procedencia y calibración nula. La revisión móvil 390×844 no mostró desbordamiento horizontal del diálogo. Se observaron cero errores JavaScript y solo tres GET de recursos OCR, sin POST ni otras solicitudes. Evidencia temporal del coordinador fuera del repositorio: `cloe-browser-check/axis-flow.mjs`, `axis-result.json`, capturas de escritorio/móvil y `axis-export.json`. Esta evidencia corresponde al componente aislado; no acredita login ni captura del sistema ni widgets reales en el despliegue.

Límites: la lectura automática se centra en etiquetas derechas y badges coloreados compatibles; imágenes borrosas, ejes en otra posición, tipografías pequeñas, colores poco contrastados o etiquetas cercanas pueden quedar sin precio o requerir corrección. No existe garantía general de precisión ni interpretación semántica del gráfico. La primera descarga del motor requiere conexión. El almacenamiento sigue siendo local al navegador; no hay sincronización en nube ni exportación CSV específica de estas etiquetas en este corte.

Caso adicional del coordinador con OCR real: badge `70.000` dejó el campo vacío y la aceptación deshabilitada, con aviso de separador ambiguo; badge `0.052` produjo `0.052`. Corregir el primero a `70000`, aceptarlo y reintentar OCR conservó la corrección junto con raw `70.000` y precio OCR nulo, y anuló la revisión general para exigir una nueva confirmación. Guardado/exportación conservaron ambas procedencias. No hubo errores JavaScript; cinco GET de recursos del motor durante el caso y su reintento, sin POST ni solicitudes inesperadas. Evidencia temporal adicional: `cloe-browser-check/axis-edge.mjs`, su exportación JSON y `axis-labels-ambiguous.png`. Esta es una comprobación puntual del riesgo de separadores, no una garantía general de exactitud OCR.
