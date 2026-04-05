/**
 * RBLogo — Consistent ReadyBoard logo lockup (animated icon + bold text, no gap).
 * Use everywhere: sidebar, landing, login, signup.
 */

type RBLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZES = {
  sm: { icon: 'h-5 w-5', text: 'text-sm' },
  md: { icon: 'h-6 w-6', text: 'text-base' },
  lg: { icon: 'h-8 w-8', text: 'text-xl' },
};

export function RBLogo({ size = 'md', className = '' }: RBLogoProps) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/readyboard-icon-animated.svg" alt="" className={s.icon} />
      <span className={`${s.text} font-bold text-zinc-100 tracking-tight`}>
        ReadyBoard
      </span>
    </div>
  );
}
