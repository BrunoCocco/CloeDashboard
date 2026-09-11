type IconProps = React.SVGProps<SVGSVGElement>;

const iconProps: IconProps = {
  "aria-hidden": true,
  fill: "none",
  height: 18,
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 1.7,
  viewBox: "0 0 24 24",
  width: 18,
};

export function Activity() {
  return <svg {...iconProps}><path d="M3 12h4l2.2-7 4.1 14 2.1-7H21" /></svg>;
}

export function Database() {
  return <svg {...iconProps}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></svg>;
}

export function CalendarClock() {
  return <svg {...iconProps}><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /><path d="M12 13v3l2 1" /></svg>;
}

export function ShieldAlert() {
  return <svg {...iconProps}><path d="M12 3 4.5 6v5.5c0 4.5 3 7.6 7.5 9.5 4.5-1.9 7.5-5 7.5-9.5V6L12 3Z" /><path d="M12 8v5m0 3h.01" /></svg>;
}

export function Wallet() {
  return <svg {...iconProps}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" /><path d="M4 7h15m-5 5h7v5h-7a2.5 2.5 0 0 1 0-5Z" /></svg>;
}

export function ArrowLeft() {
  return <svg {...iconProps}><path d="m15 18-6-6 6-6" /></svg>;
}

export function TrendUp() {
  return <svg {...iconProps}><path d="m5 15 5-5 4 4 5-6" /><path d="M14 8h5v5" /></svg>;
}

export function TrendDown() {
  return <svg {...iconProps}><path d="m5 9 5 5 4-4 5 6" /><path d="M14 16h5v-5" /></svg>;
}
