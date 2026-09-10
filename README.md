# Cloe Dashboard

Pantalla complementaria a `PreciosAlts` para visualizar el análisis técnico, fundamental y de acontecimientos de Cloe sin duplicar precios ni los gráficos principales de BTC/SOL.

## Estado

La versión `0.1` valida la arquitectura visual con datos de demostración claramente identificados. No contiene cotizaciones ni conclusiones reales.

## Arquitectura

- Next.js 16, React 19 y TypeScript.
- Tailwind CSS 4.
- Supabase como histórico acumulativo (pendiente de conectar y aplicar).
- Vercel para vistas previas y producción.

La base separa datos objetivos, análisis independientes y síntesis. El esquema declarativo propuesto está en `supabase/schema.sql` y no se ha aplicado a una base remota.

## Desarrollo

```bash
npm install
npm run dev
```

Variables previstas en `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (solo servidor)

Nunca se deben subir valores reales de estas variables a GitHub.
