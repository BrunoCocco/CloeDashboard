type InterpretationPanelProps = {
  eyebrow: string;
  title: string;
  text: string;
};

export function InterpretationPanel({ eyebrow, title, text }: InterpretationPanelProps) {
  return (
    <aside className="panel dashboard-interpretation-panel p-4" aria-label={title}>
      <p className="metric-label">{eyebrow}</p>
      <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
      <p className="dashboard-interpretation-copy mt-4 text-sm leading-6 text-zinc-300">{text}</p>
    </aside>
  );
}
