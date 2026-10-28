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
