# Protocolo CLOE — actualización y verificación del dashboard

Protocolo aprobado por Bruno el 01/10/2026. Leer completo antes de cada actualización. Una carga no termina hasta comprobar lo que el dashboard recupera y muestra.

## 1. Objetivo y alcance
CLOE aporta análisis para un usuario con experiencia en mercados: relaciones causales, estructura, divergencias, escenarios e invalidaciones. Mantener independientes Fundamental, Fechas, Técnico, Derivados y posicionamiento; Síntesis cruza sus resultados sin cambiarlos. Excluir decisiones automáticas, estados operativos, carteras y balances del informe. La autorización permanente permite actualizar datos analíticos; cambios de código, diseño, autenticación o producción requieren un encargo específico.

## 2. Antes de empezar
- `list_projects` puede omitir un proyecto accesible: no prueba ausencia ni desconexión. Para CloeDashboard, confirmar la referencia `wvwxwutjdqsktnrcdbkf` mediante `get_project` y una consulta de lectura `execute_sql` antes de declarar falta de acceso. No elegir FuturosLab por ser el único proyecto listado.
- Cada carga fallida debe quedar como incidencia explícita. En la siguiente ejecución recuperar el último corte real y completar únicamente el backlog trazable; distinguir restauración retrospectiva de publicación original.
- Leer este protocolo y confirmar proyecto, usuario, tablas y lector del dashboard desplegado; no elegir identificadores sólo por memoria.
- Recuperar último corte y últimas observaciones vigentes; revisar histórico relevante.
- Identificar novedades, datos vigentes y correcciones.
- Confirmar fecha de observación, fecha de consulta y zona horaria. Nunca presentar una vela o publicación antigua como información de hoy.

## 3. Fundamental y continuidad macro
Verificar siempre `dxy`, `stablecoin_market_cap`, `m2_usa` y `global_m2`.
- DXY: distinguir cierre, cotización y máximo intradía.
- Stablecoins: capitalización total y variaciones verificadas.
- M2 USA: última observación oficial, mes y revisiones.
- Global M2: agregado consistente de EE. UU., eurozona, China y Japón en USD; documentar fuentes, metodología y efecto cambiario.
- Mostrar valor, unidad, fecha real y fuente; conservar último valor verificado sin publicación nueva. Añadir sólo observaciones nuevas, no duplicar datos diarios sin cambios.
- Si falla fuente: marcar “sin actualización”, conservar último dato. Verificar claves iguales a las del lector del dashboard.
- Revisar WALCL, TGA `WDTGAL`, RRP y liquidez neta; tipos/expectativas Fed, 2Y/10Y/curva, petróleo, inflación, empleo, capitalización cripto, TOTAL/TOTAL3/BTC.D/USDT.D cuando fiables.
- Fórmula: WALCL − WDTGAL − RRP, misma unidad antes de calcular; RRPONTSYD requiere conversión cuando WALCL está en millones. Documentar fechas desalineadas. Nunca usar “B” sin definir unidad.
- Fear & Greed: fuente, escala, clasificación e historia; peso fuerte sólo en extremos. Halving contexto de peso intermedio.
- Analizar nivel, primera derivada, aceleración, persistencia y transmisión, no sólo cifras.

## 4. Fechas: calendario real
Mencionar evento en informe no equivale a cargarlo.
- Consultar calendarios oficiales, cubrir 24H/7D/30D y guardar cada evento confirmado en `market_events`.
- Incluir fecha/hora Europe/Madrid con cambios horarios, importancia, fuente y canal de impacto; consenso/anterior sólo verificados.
- Evitar duplicados por nombres, registrar aplazamientos/cancelaciones con trazabilidad y revisar estado de vencidos.
- Filtrar eventos futuros ANTES de ordenar y limitar; eventos antiguos no deben ocupar plazas futuras. Anuncios sin fecha deben identificarse explícitamente.
- Comparar informe, tabla y consulta visible: ningún evento confirmado mencionado puede quedar sin incorporar.

## 5. Técnico: siete activos e histórico continuo
BTC, SOL, XRP, HBAR, XLM, VELO y SHX; exclusivamente gráfico, precio y volumen.
- Nuevas velas amplían histórico, no lo reemplazan. Revisar huecos, duplicados y mercado de origen.
- Separar vela abierta/cerrada; estructura diaria y 4H disponibles; aceptación/rechazo, tendencia/rango, soportes, resistencias, volumen.
- RSI, Bollinger, VWAP mensual y MA20 cuando serie suficiente; Wyckoff/Elliott inferencias probabilísticas.
- Confirmaciones e invalidaciones explícitas. Documentar faltantes por activo/indicador, no inventar niveles ni lecturas para completar tarjeta.

## 6. Derivados, opciones y ETF
BTC/SOL: OI y cambios, funding e intervalo, basis, liquidaciones, spot/futuros, taker flow, CVD comparable, OI opciones por strike/vencimiento, calls/puts, IV, skew y estructura temporal; ETF flujos netos y acumulados de última sesión.
- Identificar exchange, contrato, cobertura, unidad y hora; no mezclar OI específico/agregado.
- AUM no equivale a flujo ETF; predominio calls/puts no determina dirección.
- Gamma de dealers, max pain y coberturas requieren datos y supuestos suficientes; exponer discrepancias/limitaciones.
- Explicar efecto en perpetuos. Verificar laboratorio de opciones por separado: actualizar dashboard principal no implica actualizar laboratorio.

## 7. Síntesis CLOE
DATO → ANÁLISIS → HIPÓTESIS → IMPLICACIÓN. Coincidencias, contradicciones, pesos/calidad, cambios frente a corte previo, escenarios base/alcista/bajista con catalizadores, confirmaciones, invalidaciones y señales tempranas. No usar probabilidades numéricas sin método.

## 8. Carga y comprobación final
- Carga idempotente, conserva histórico; verificar siete Técnicos, Fundamental, Derivados, Fechas y Síntesis.
- Formato compatible con lector; leer registros después de escribir y comprobar cuatro métricas macro vigentes.
- Ejecutar consulta real de próximos eventos y revisar visualización de módulos/fechas/fuentes; contrastar con informe entregado.
- No declarar “actualizado y verificado” sólo porque escritura tuvo éxito.
- Informar exactamente qué se actualizó, qué falta, por qué y hasta dónde se verificó. Si acceso autenticado impide inspección visual, decirlo.

## Separación de análisis y gestión
El diario describe el panorama del día hasta el corte explícito Europe/Madrid y los cambios frente al último corte válido. El intradía bajo demanda actualiza BTC/SOL en 15m y 1h exclusivamente con gráfico, precio y volumen actuales verificados; 4H puede aportar contexto adicional.
Cada cotización identifica fuente, exchange, mercado/contrato, par, moneda, tipo de precio, timestamp del dato y hora de consulta. Si la actualidad o la serie no se puede verificar, declarar insuficiencia por activo; no reutilizar precios de noticias ni inventar niveles o indicadores.
El seguimiento de operaciones se concentra en Cloe Gestión mediante Telegram bajo sus reglas CG-1.0, separado de los informes analíticos. Conservar los saldos reales y el histórico analítico.
