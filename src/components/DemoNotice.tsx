import { DEMO_NOTICE_TEXT } from "@/lib/demoNotice";

/** Always-visible notice: this deployment is a public demo with ONE shared account. */
export function DemoNotice() {
  return (
    <div
      role="note"
      data-testid="demo-notice"
      className="border-b border-[var(--color-ink)]/10 bg-[var(--color-butter,#fff3c4)] px-4 py-2 text-center text-xs font-semibold text-[var(--color-ink)]"
    >
      {DEMO_NOTICE_TEXT}
    </div>
  );
}
