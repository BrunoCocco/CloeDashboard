# Cloe Dashboard

Pantalla complementaria a `PreciosAlts` para visualizar el análisis técnico, fundamental y de acontecimientos de Cloe sin duplicar precios ni los gráficos principales de BTC/SOL.

## Estado

La aplicación usa autenticación de Supabase, protege el dashboard y lee únicamente los registros del usuario conectado mediante RLS. Cuando todavía no existen análisis, muestra estados vacíos en lugar de datos simulados.

## Arquitectura

- Next.js 16, React 19 y TypeScript.
- Tailwind CSS 4.
- Supabase como histórico acumulativo y autenticación.
- Vercel para vistas previas y producción.

La base separa datos objetivos, análisis independientes y síntesis. El esquema declarativo está versionado en `supabase/schema.sql` y en `supabase/migrations/`.

## Desarrollo

```bash
npm install
npm run dev
```

Variables previstas en `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Nunca se deben subir valores reales de estas variables a GitHub.
