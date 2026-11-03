# ZIP y contexto de mercado · 03/11/2026

Regla de entrega aprobada: análisis del ZIP primero; revisión independiente de Fundamental, liquidez, sentimiento, derivados y Fechas debajo. Sustituye la restricción anterior de entrega exclusivamente técnica. No automatiza la ingesta de archivos ni crea un servicio recurrente fuera de conversación.

La UI presenta el mercado por defecto mediante un Server Component en Suspense: la consulta inferior no bloquea el corte técnico. El fallo de mercado no elimina el análisis del ZIP. Conserva fuentes/fechas y las observaciones originales. Los datos se recuperan por propietario; sin cambios de Auth/RLS/esquema.

Revisión inicial: añadidas observaciones de Fed/TGA/RRP alineadas28oct, RRP2nov, M2USA septiembre, rendimientos2Y/10Y30oct, agregadoGlobalM2 del proveedor, stablecoinsAPI, DXY de sesiónReuters, CMCmiedo/capitalización/dominancia. No se mezclan índices de miedo de proveedores diferentes. GlobalM2no fue reconstruido independientemente; la fuente y el mes subyacente están en evidence. Stablecoins: API y páginas públicas discrepan; la UI identifica el agregadoAPI sin reconciliación ficticia. Algunos datos intradía CMC carecen de timestamp de observación: se etiqueta hora de consulta. Volúmenes y variacionesOIincoherentes se excluyen; opciones y flujosETF quedan pendientes. Se conserva evidencia numérica y respuestas originales en el nuevo fundamental y la síntesis diaria.

Calendario BLS: ocho eventos futuros incorporados idempotentemente con horario oficial convertido aUTC. Sin consenso inventado. Se conserva el archivo anterior. El contexto es posterior a la captura técnica, nunca evidencia retrospectivamente disponible en ella.

Validación: lint, tipos, nueve pruebas y compilación correctos. Lector real ejecutado con registros recuperados de nube:13métricas, Fear&Greed35, síntesis3nov y cinco próximos eventos; filtros por propietario. La visualización autenticada de producción sigue fuera del alcance de esa prueba aislada.
