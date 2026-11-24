export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#17181C" />
      <path d="M9.5 18.5a6.5 6.5 0 0 1 0-9" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.5 9.5a6.5 6.5 0 0 1 0 9" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2.5" fill="#F64C31" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 px-1.5">
      <LogoMark />
      <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">Open Social Listening</span>
    </span>
  );
}
