// Shared "How this changes the workflow" panel. Same visual treatment used on
// L2 originally, lifted out so every demo (A1, A3 deal view, A3 Blocker Center,
// L1 inbox, C3 chat) can mount it with its own before/after copy.

type Props = {
  today: string;
  withDemo: string;
  withDemoLabel?: string;
};

export function WorkflowChangePanel({ today, withDemo, withDemoLabel }: Props) {
  return (
    <div className="rounded-md border border-border bg-background-subtle px-5 py-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted mb-3">
        How this changes the workflow
      </p>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-4 md:gap-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-faint mb-1.5">
            Today
          </p>
          <p className="text-[13px] leading-[1.55] text-foreground-muted">{today}</p>
        </div>
        <div className="hidden md:block bg-border" aria-hidden="true" />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-faint mb-1.5">
            {withDemoLabel ?? "With this demo"}
          </p>
          <p className="text-[13px] leading-[1.55] text-foreground">{withDemo}</p>
        </div>
      </div>
    </div>
  );
}
