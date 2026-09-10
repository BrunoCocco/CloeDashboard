import type { MarketEvent } from "@/data/dashboard-demo";

export function EventsPanel({ events }: { events: MarketEvent[] }) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <div><p className="metric-label">Fechas</p><h2 className="mt-1 text-base font-semibold text-white">Próximos acontecimientos</h2></div>
        <span className="badge badge-warning">Ejemplos</span>
      </div>
      <ol className="mt-4 space-y-3">
        {events.map((event) => (
          <li className="grid grid-cols-[3rem_1fr_auto] items-center gap-3" key={event.title}>
            <div className="rounded-md border border-border bg-surface px-2 py-1.5 text-center font-mono"><span className="block text-[9px] uppercase text-muted">{event.month}</span><strong className="text-sm text-zinc-200">{event.day}</strong></div>
            <div><p className="text-xs font-medium text-zinc-200">{event.title}</p><p className="mt-0.5 text-[10px] text-muted">{event.scope}</p></div>
            <span className={event.impact === "Alto" ? "badge badge-warning" : "badge badge-muted"}>{event.impact}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
