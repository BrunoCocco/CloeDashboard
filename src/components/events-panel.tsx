import type { MarketEvent } from "@/lib/dashboard";

export function EventsPanel({ events }: { events: MarketEvent[] }) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <div><p className="metric-label">Fechas</p><h2 className="mt-1 text-base font-semibold text-white">Próximos acontecimientos</h2></div>
        <span className="badge badge-muted">{events.length} próximos</span>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 rounded-md border border-border bg-surface px-3 py-4 text-sm text-muted">
          No hay acontecimientos próximos registrados.
        </p>
      ) : <ol className="mt-4 space-y-3">
        {events.map((event, index) => (
          <li className="grid grid-cols-[3rem_1fr_auto] items-center gap-3" key={`${event.title}-${index}`}>
            <div className="rounded-md border border-border bg-surface px-2 py-1.5 text-center font-mono"><span className="block text-[9px] uppercase text-muted">{event.month}</span><strong className="text-sm text-zinc-200">{event.day}</strong></div>
            <p className="text-xs font-medium text-zinc-200">{event.title}</p>
            <span className={event.impact === "Alto" ? "badge badge-warning" : "badge badge-muted"}>{event.impact}</span>
          </li>
        ))}
      </ol>}
    </section>
  );
}
