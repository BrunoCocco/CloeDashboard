"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <section className="panel w-full max-w-lg p-6 text-center sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-rose-300">Conexión interrumpida</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">No se pudo cargar el dashboard</h1>
        <p className="mt-3 text-base leading-6 text-zinc-400">
          La sesión está protegida, pero la consulta de datos falló. Podés volver a intentarlo sin cerrar sesión.
        </p>
        <button className="button-primary mt-6" type="button" onClick={reset}>Reintentar</button>
      </section>
    </main>
  );
}
