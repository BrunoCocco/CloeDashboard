# Contexto técnico de Cloe Dashboard

## Fuentes de verdad

- Repositorio: `BrunoCocco/CloeDashboard`.
- Producción: `https://cloe-dashboard.vercel.app`.
- Supabase: proyecto `CloeDashboard`, referencia `wvwxwutjdqsktnrcdbkf`.
- Rama de producción: `main`; GitHub activa el despliegue automático de Vercel.
- Antes de modificar o desplegar, consulta el estado vivo. No asumas que este documento contiene el último commit o despliegue.

## Aplicación

- Next.js App Router, React, TypeScript y Tailwind.
- Supabase SSR Auth protege el dashboard y las rutas privadas.
- La vista principal muestra síntesis, Técnico, macro, eventos y radar de activos.
- `/carteras` mantiene Spot y Futuros fuera de la vista principal.
- CoinGecko Simple Price aporta cotización y variación de 24 horas; debe existir un fallback explícito para fallos o límites de la API.

## Datos

Tablas de análisis: `assets`, `candles`, `technical_analyses`, `macro_observations`, `fundamental_analyses`, `market_events`, `news_items`, `daily_syntheses`.

Tablas de cartera: `portfolio_accounts`, `portfolio_positions`, `portfolio_snapshots`.

Reglas:

- Los datos pertenecen a `user_id` y las lecturas se limitan con RLS a `auth.uid()`.
- El cliente autenticado tiene lectura; las cargas quedan del lado administrativo.
- Los snapshots son acumulativos. Una actualización no reemplaza el histórico.
- Las posiciones reales, simuladas, Spot y Futuros no se combinan.

## Entrega

- Trabaja sobre una rama basada en el `main` actual.
- Migra Supabase antes de desplegar código que dependa del nuevo esquema y verifica las consultas.
- Ejecuta advisors de seguridad y rendimiento después de DDL.
- Construye y verifica la vista previa antes de solicitar la confirmación de Cloe.
- Tras publicar, comprueba estado `READY`, rutas afectadas y errores de ejecución; registra el commit desplegado.
