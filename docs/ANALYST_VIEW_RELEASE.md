# Vista de analista · 03/11/2026

Implementa la propuesta visual aprobada por Bruuno: selector de activos, cabecera del corte, lectura principal, referencias, dos escenarios condicionales, comparación con corte anterior, lecturas por marco e histórico visible. Exportación íntegra y detalle desplegable conservados.

Los datos proceden del archivo autenticado por propietario. No se incorporan cotizaciones vivas ni sesgos inventados. La comparación de precio exige activo, par, exchange, mercado y unidad coincidentes; no equivale a retorno24h. El corte anterior se busca dentro de la página actual del archivo y del mismo activo; si falta, se indica expresamente. La referencia gráfica ordena valores y es esquemática, no una escala de precios. Correcciones y originales siguen accesibles.

No se modificaron Auth, RLS, esquema, registros históricos ni ingesta. Macro sigue bajo demanda y con corte independiente. No se añadieron dependencias al proyecto.

Verificado: lint, TypeScript, nueve pruebas existentes y build Next16.3.4. Prueba en Chromium de los componentes originales con snapshots reales del1y3nov, sesión aislada: escritorio1536px/móvil390px, sin desbordamiento ni erroresJS; selector de siete activos y enlaces de histórico; detalle y exportaciónJSON idéntica al snapshot original. El link de Next se representa como ancla en este harness. No equivale a recorrido autenticado de producción.
