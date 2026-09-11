import { login, signUp } from "./actions";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = first(params.error);
  const message = first(params.message);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <section className="panel w-full max-w-md p-6 sm:p-8" aria-labelledby="login-title">
        <div className="flex items-center gap-4 border-b border-border pb-5">
          <div className="grid size-12 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 font-mono text-sm font-black tracking-[0.16em] text-cyan-300">
            CL
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">Acceso privado</p>
            <h1 id="login-title" className="mt-1 text-2xl font-semibold text-white">Cloe Dashboard</h1>
          </div>
        </div>

        <p className="mt-5 text-base leading-6 text-zinc-300">
          Iniciá sesión para consultar tu histórico técnico, fundamental y de acontecimientos.
        </p>

        {error ? <p className="form-alert form-alert-error" role="alert">{error}</p> : null}
        {message ? <p className="form-alert form-alert-success" role="status">{message}</p> : null}

        <form className="mt-6 space-y-4">
          <div>
            <label className="form-label" htmlFor="email">Email</label>
            <input className="form-input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input className="form-input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required />
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <button className="button-primary" formAction={login}>Entrar</button>
            <button className="button-secondary" formAction={signUp}>Crear cuenta</button>
          </div>
        </form>

        <p className="mt-5 text-sm leading-5 text-muted">
          Cada cuenta accede únicamente a sus propios registros mediante políticas RLS.
        </p>
      </section>
    </main>
  );
}
