import { cn } from "@/lib/ui/cn";

/**
 * The mark: a dot with two signal arcs. `animated` pulses the arcs outward (loading screen); in the logo they
 * pulse once while the pointer is over it.
 */
export function LogoMark({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  const arc = cn(animated ? "animate-signal" : "group-hover/logo:animate-signal");
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <rect width="28" height="28" rx="8" fill="#17181C" />
      <path d="M9.5 18.5a6.5 6.5 0 0 1 0-9" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" className={arc} />
      <path d="M18.5 9.5a6.5 6.5 0 0 1 0 9" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" className={cn(arc, "[animation-delay:200ms]")} />
      <circle cx="14" cy="14" r="2.5" fill="#F64C31" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="group/logo flex items-center gap-2.5 px-1.5">
      <LogoMark />
      <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">Open Social Listening</span>
    </span>
  );
}
