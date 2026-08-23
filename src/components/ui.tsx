"use client";

export function Chip({
  children,
  active,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: "neutral" | "coral" | "mint" | "gold";
}) {
  const tones: Record<string, string> = {
    neutral: active
      ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
      : "bg-white text-[var(--color-ink-soft)] border-[var(--color-line)]",
    coral: active
      ? "bg-[var(--color-coral)] text-white border-[var(--color-coral)]"
      : "bg-[var(--color-coral-light)] text-[var(--color-coral-dark)] border-transparent",
    mint: active
      ? "bg-[var(--color-mint)] text-white border-[var(--color-mint)]"
      : "bg-[var(--color-mint-light)] text-[var(--color-mint)] border-transparent",
    gold: active
      ? "bg-[var(--color-gold)] text-white border-[var(--color-gold)]"
      : "bg-[var(--color-gold-light)] text-[var(--color-gold)] border-transparent",
  };
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${tones[tone]}`}
    >
      {children}
    </Comp>
  );
}

export function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] card-shadow ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-coral)] px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--color-coral-dark)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-5 py-3 text-sm font-bold text-[var(--color-ink)] transition-all hover:bg-[var(--color-cream)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60 ${className}`} />
  );
}

export function EmptyState({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-line)] px-6 py-14 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-base font-semibold text-[var(--color-ink)]">{title}</p>
      {subtitle && <p className="max-w-xs text-sm text-[var(--color-ink-soft)]">{subtitle}</p>}
      {action}
    </div>
  );
}

export function ProgressBar({ pct, tone = "coral" }: { pct: number; tone?: "coral" | "mint" }) {
  const color = tone === "mint" ? "var(--color-mint)" : "var(--color-coral)";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  );
}
