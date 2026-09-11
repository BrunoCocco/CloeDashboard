import type { AssetRow } from "@/lib/dashboard";

export function AssetRadar({ assets }: { assets: AssetRow[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div><p className="metric-label">Seguimiento completo</p><h2 className="mt-1 text-base font-semibold text-white">Radar de activos</h2></div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{assets.length} activos</span>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead className="bg-surface/70 font-mono text-[10px] uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-2.5 font-medium">Activo</th><th className="px-3 py-2.5 font-medium">Estructura</th><th className="px-3 py-2.5 font-medium">Viento</th><th className="px-3 py-2.5 font-medium">Soporte</th><th className="px-3 py-2.5 font-medium">Resistencia</th><th className="px-4 py-2.5 text-right font-medium">Estado</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.map((asset) => (
              <tr className="transition-colors hover:bg-white/[0.02]" key={asset.symbol}>
                <td className="px-4 py-3 font-semibold text-white">{asset.symbol}</td><td className="px-3 py-3 text-zinc-300">{asset.structure}</td><td className="px-3 py-3 text-zinc-400">{asset.wind}</td><td className="px-3 py-3 font-mono text-zinc-400">{asset.support}</td><td className="px-3 py-3 font-mono text-zinc-400">{asset.resistance}</td><td className="px-4 py-3 text-right"><span className="badge badge-muted">{asset.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
