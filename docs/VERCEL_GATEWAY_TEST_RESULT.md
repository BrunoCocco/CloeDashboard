# Prueba de integración Vercel AI Gateway

Corte: 28 de octubre de 2026. Rama de trabajo: `vista-graficosxrp`.

## Resultado

La integración está implementada y las pruebas locales pasan. **No se pudo ejecutar una lectura real con el proveedor:** no hay credencial de AI Gateway, modelo, habilitación ni lista de usuarios configurados. No se compraron créditos, no se activaron pagos y no se enviaron capturas privadas. Cero solicitudes de generación reales; no hay precisión de visión ni coste por solicitud medidos.

## Qué se comprobó

- SDK instalado `ai@7.0.155`, Zod `4.6.7` y APIs verificadas contra su documentación versionada: salida estructurada con `generateText` / `Output.object` y PNG binario.
- Gates de servidor: sesión, habilitación explícita, credencial, modelo y lista de usuarios; luego consentimiento, origen permitido, PNG y tamaño/dimensiones. Sin configuración, no se importa ni invoca el proveedor. Un OIDC ambiental no los elude.
- Suite local: 37 pruebas correctas. Incluye datos estructurados, tres paneles e indicadores arbitrarios, CSV, histórico, autenticación, configuración deshabilitada y una respuesta de proveedor **simulada**. No confundir esa simulación con conexión real.
- Lint y TypeScript correctos en esta comprobación. La última compilación de aplicación ya pasó y no se cambió código de la app para este diagnóstico.
- El coordinador verificó Vercel: rama desplegada READY en `a451d84`, sin variables `AI_GATEWAY_API_KEY`, `VISION_MODEL` ni `CLOE_VISION_*` en ningún entorno. El entorno local sólo dispone de configuración pública de Supabase, sin credenciales Gateway/OIDC.
- Catálogo público consultado por el coordinador: 498 modelos y 212 con entrada de imagen y salida estructurada. La disponibilidad pública no prueba acceso de la cuenta, créditos gratuitos ni elegibilidad de un modelo. No se seleccionó un modelo por memoria.
- Sin credencial no se pudo consultar saldo, presupuesto, Logs ni facturación de la cuenta. La documentación actual indica que los créditos gratuitos requieren verificación mediante un método de pago válido; no se añadió ni se modificó ninguno.

## Fixture reproducible preparada

```bash
python scripts/generate-vision-fixture.py --output /tmp/cloe-vision-fixture
```

Requiere Python y Pillow. Genera `synthetic-widget.png` y `expected.json` fuera del repositorio, sin leer imágenes personales. El PNG está marcado como prueba sintética y contiene tres paneles con OHLC, precio mostrado, volumen, VWAP Session, SMA, RSI, EMA, Bollinger y marcas con etiquetas conocidas. El JSON es la referencia de evaluación, **no una respuesta del modelo ni un análisis de mercado**.

Comprobaciones previstas para la futura lectura real:

1. Reconocer todos los paneles e indicadores, con sus parámetros y unidades visibles.
2. Leer `Session` en VWAP en lugar de copiar el `Quarter` programado en la app.
3. Distinguir la referencia RSI 50 de los valores RSI 63.50/37.25.
4. Atribuir OHLC a la vela histórica bajo cursor, sin llamarlo precio actual.
5. Separar los números etiquetados de coordenadas gráficas aproximadas y registrar ilegibilidad sin inventar.

La fixture se generó y revisó visualmente; todavía no se envió a un proveedor. Que una imagen sintética sea legible no demuestra exactitud con capturas reales de TradingView.

## Paso que falta para probar de extremo a extremo

Desde la cuenta autorizada de Vercel: comprobar acceso al Gateway, créditos disponibles, elegibilidad y precio del modelo; aprobar el coste máximo del piloto y preparar una credencial con presupuesto controlado. Guardar los valores sólo mediante el mecanismo seguro de Vercel, nunca en conversación ni Git. Después configurar `VISION_MODEL`, `CLOE_VISION_USER_IDS` y, al final, `CLOE_VISION_ENABLED=true` en esta rama de vista previa.

Entonces podrá ejecutarse **una** solicitud con la fixture pública, comparar la respuesta contra `expected.json` y revisar en Logs modelo/proveedor, consumo y coste real antes de usar capturas privadas. No se considera la prueba gratuita únicamente porque exista un saldo positivo. La activación, el acceso a facturación y cualquier compra permanecen pendientes; este trabajo no los realiza.

## Comprobación posterior: credencial y saldo verificados en Vercel

El 28 de octubre de 2026 se confirmó que `AI_GATEWAY_API_KEY` ya está guardada como variable sensible en production, preview y development. No se recuperó ni se imprimió su valor. Esta comprobación posterior amplía el corte anterior; no convierte las pruebas simuladas previas en una lectura real.

Se ejecutó el script de sólo lectura dentro del build de una vista previa, reutilizando la credencial existente mediante un override temporal:

```bash
node scripts/gateway-preflight.mjs && npm run build
```

Evidencia: despliegue `dpl_2rLsfTW4EqeFjd3Hr1uoKnw1YQ5X`, commit remoto `d6d389ec1b9716b002fc9e160082013dbbcd65c0`. El preflight realizó únicamente `GET https://ai-gateway.vercel.sh/v1/credits` y devolvió:

```json
{
  "event": "CLOE_GATEWAY_PREFLIGHT",
  "generationTested": false,
  "freeTierVerified": false,
  "status": "ok",
  "httpStatus": 200,
  "balanceUsd": 0,
  "totalUsedUsd": 0
}
```

La credencial permite consultar la cuenta. El saldo reportado y el consumo acumulado son cero. **Esto no prueba por sí solo que falte elegibilidad para créditos gratuitos:** su habilitación puede depender del primer uso o de la verificación de la cuenta; esta consulta no verifica esas condiciones. Tampoco demuestra acceso a un modelo concreto ni que una generación vaya a ser gratuita.

No se ejecutó ninguna generación, no se envió imagen alguna ni se compraron créditos. El script no registra secretos, cuerpos de error ni cabeceras; sólo devuelve estados fijos y cifras validadas. No se modificó el comando de build predeterminado del proyecto ni se abrió un endpoint público de diagnóstico.

Siguen pendientes `VISION_MODEL`, `CLOE_VISION_ENABLED` y `CLOE_VISION_USER_IDS`, además de comprobar modelo elegible y las condiciones del piloto antes de una lectura real. La validación de la captura sintética contra los valores esperados continúa pendiente. No se cambió la configuración para activar visión ni pagos como parte de esta actualización documental.

## Intento posterior: una solicitud real de lectura de líneas

Se ejecutó una única solicitud de visión con una imagen sintética propia de un panel y tres líneas horizontales reproducibles (semilla `20261028`). Dos líneas tenían precio escrito y una no tenía etiqueta, para distinguir extracción literal de estimación por el eje. No se enviaron capturas privadas ni datos reales del mercado. El runner reutilizó `generateWidgetReading` y el esquema de producción; al modelo se le entregaron únicamente los bytes PNG, sin los valores de referencia del generador.

Evidencia: despliegue `dpl_5WKu29tRXo6TvJDmYtfdEJitfYEN`, commit remoto `4cac02747daa5c230ebbcfa5ec56e5b3cbaf74a4`.

```json
{
  "event": "CLOE_LINE_RECOVERY",
  "synthetic": true,
  "generationAttempted": true,
  "freeTierVerified": false,
  "model": "google/gemini-2.5-flash-lite",
  "postCount": 1,
  "status": "provider_failed",
  "httpStatus": 403,
  "reason": "customer_verification_required"
}
```

**El Gateway rechazó la solicitud por verificación de cliente pendiente. El modelo no procesó la captura y no devolvió una lectura.** Esto confirma un intento real y su bloqueo; no es una lectura exitosa ni una medida de precisión de la integración. No hubo reintentos, compra de créditos ni cambios de verificación de la cuenta. No se infiere elegibilidad gratuita ni acceso operativo al modelo.

### Inspección visual de Cloe, separada de la API

El coordinador inspeccionó directamente el PNG y fijó su lectura **antes** de consultar los valores del generador. Esta es una lectura visual de Cloe en la conversación, no una respuesta del Gateway ni una función automática ya verificada de la app:

| Elemento | Lectura visual de Cloe | Referencia del generador | Comparación |
| --- | --- | --- | --- |
| Línea amarilla con etiqueta | 101.75 USD | 101.75 USD | Coincide literalmente |
| Línea celeste con etiqueta | 104.00 USD | 104.00 USD | Coincide literalmente |
| Línea violeta sin etiqueta | Aproximadamente 102.80 USD | 102.75 USD | Error absoluto de estimación: 0.05 USD |
| RSI | 63.50 | 63.50 | Distinto de la referencia central 50 |
| VWAP | 101.25 USD, Session | 101.25 USD, Session | No se copió Quarter desde la configuración de la app |

La coincidencia de estas etiquetas y la estimación de una línea en esta imagen sintética no permiten afirmar precisión general en gráficos reales, otras escalas o imágenes de distinta calidad.

La fixture está conservada en `scripts/fixtures/line-recovery.json` como PNG base64 y valores esperados separados; se reproduce mediante `python scripts/generate-line-recovery-fixture.py`. El runner y sus cinco pruebas enfocadas verifican modo de simulación sin red, modelo explícito, saldo cero previo, transporte limitado a un POST y diagnóstico sin secretos. La comprobación visual manual no reemplaza la prueba automática pendiente.

Pendiente para continuar: resolver la verificación de cliente desde la cuenta de Vercel con autorización del usuario y comprobar las condiciones de créditos/modelo antes de otro intento. No se ha realizado esa verificación ni se ha programado un reintento automático.


## Continuidad posterior al trabajo desde móvil — 2026-10-28

### Estado observado y corte vigente

La rama `vista-graficosxrp` avanzó después del corte anterior mediante cuatro commits: `e06c5ce` (detector de píxeles sin conexión), `c6ee19f` (integración de candidatas locales), `c602b5c` (desactivación de consultas periódicas) y `d61e11b2bacb2f81dfc08ff763765fbc7af4df67` (bloqueo del endpoint remoto). Este último es la base de esta actualización documental. El coordinador comprobó el despliegue `dpl_vmqJTkyDc7Um6bH76F9RKMEEBSip` en estado `READY` para ese SHA; READY acredita el despliegue, no una prueba del flujo completo en navegador.

La lectura remota y sus instrucciones de activación descritas arriba quedan como **histórico**. El código vigente mantiene la visión remota desactivada: GET devuelve `configured: false` y `status: disabled_local_only`; POST responde 503 y no importa ni invoca al proveedor. El editor no inicia consultas de estado ni envíos de imagen a ese endpoint. No se reactivó la API, no se ejecutaron solicitudes reales y no se modificaron claves durante esta actualización.

El cuaderno incorpora ahora un detector geométrico local sobre los píxeles de la captura mediante canvas. Esta detección no envía la imagen a la red: produce candidatas de líneas horizontales con coordenadas de imagen, `source: pixel-local`, `confidence: candidate` y `price: null`. Una candidata no es un soporte o resistencia confirmado ni un precio recuperado. Esto no implica que toda la aplicación funcione sin red: los widgets y otros recursos conservan sus conexiones propias.

### Pendientes concretos

- Calibrar el eje del gráfico para convertir coordenadas a precios, con revisión y límites explícitos.
- Superponer las candidatas sobre la captura para que el usuario pueda revisarlas y descartarlas.
- Persistir detecciones y su procedencia: actualmente `localLines` vive en estado del componente, sin incorporarse al modelo ni al almacenamiento del cuaderno.
- Validar el detector con capturas reales y el flujo de navegador; no inferir precisión ni funcionamiento completo desde la inspección del código.
- Actualizar las pruebas frente al modo local y al endpoint bloqueado. Los resultados anteriores de la suite corresponden a cortes históricos; no se declara vigente una cifra de pruebas sin ejecutarlas sobre este corte.

### Límites de esta actualización

Se revisaron las instrucciones actuales del repositorio y los archivos del detector, del cuaderno y del endpoint; solo se añade este registro. Los siguientes pasos son propuestas de desarrollo, no funciones ya completadas. No hubo cambios de código, base de datos, autenticación, configuración ni pruebas de ejecución de la app.

No se localizó una anotación móvil nueva específica en Drive o Library; el documento de pendientes encontrado era anterior y la fuente de contexto personal no estuvo disponible. Por tanto, esta continuidad se reconstruye desde el estado verificable del repositorio y el despliegue comunicado por el coordinador, sin atribuir decisiones adicionales a una nota no encontrada.
