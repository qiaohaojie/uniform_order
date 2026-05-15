import { CheckIcon } from "@/components/icons";

const STEPS = ["Placed", "Ready", "Completed"] as const;

export type StepperStatus = "to_prepare" | "ready" | "completed";

const STATUS_TO_INDEX: Record<StepperStatus, number> = {
  to_prepare: 0,
  ready: 1,
  completed: 2,
};

export function OrderStatusStepper({
  status,
  accent,
}: {
  status: StepperStatus;
  accent: string;
}) {
  const currentIndex = STATUS_TO_INDEX[status];

  return (
    <div className="flex items-start justify-between relative px-1">
      {/* Rails inset to dot-center positions */}
      <div
        className="absolute h-0.5"
        style={{ left: 32, right: 32, top: 12, background: "var(--color-rule)" }}
      />
      <div
        className="absolute h-0.5 transition-all"
        style={{
          left: 32,
          top: 12,
          width: `calc((100% - 64px) * ${currentIndex / (STEPS.length - 1)})`,
          background: accent,
        }}
      />
      {STEPS.map((label, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;
        return (
          <div
            key={label}
            className="flex flex-col items-center gap-2 relative z-10"
            style={{ width: 64 }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: isFuture ? "var(--color-paper)" : accent,
                border: `1.5px solid ${isFuture ? "var(--color-rule)" : accent}`,
                color: isFuture ? "var(--color-ink-dim)" : "#fff",
              }}
            >
              {isCompleted ? (
                <CheckIcon size={14} />
              ) : (
                <span className="text-[11px] font-bold">{i + 1}</span>
              )}
            </div>
            <div
              className="text-[10.5px] font-semibold tracking-[0.3px] text-center"
              style={{
                color: isCurrent
                  ? accent
                  : isFuture
                  ? "var(--color-ink-dim)"
                  : "var(--color-ink)",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
