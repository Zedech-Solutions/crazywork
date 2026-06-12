"use client";

import { useEffect, useState } from "react";

function remaining(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  };
}

export function CountdownTimer({ until, label }: { until: string; label?: string }) {
  const target = new Date(until);
  const [time, setTime] = useState<ReturnType<typeof remaining> | null>(null);

  useEffect(() => {
    setTime(remaining(target));
    const interval = setInterval(() => setTime(remaining(target)), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);

  if (!time) return null;

  const cells = [
    { value: time.days, unit: "D" },
    { value: time.hours, unit: "H" },
    { value: time.minutes, unit: "M" },
    { value: time.seconds, unit: "S" },
  ];

  return (
    <div className="inline-flex items-center gap-3">
      {label && <span className="eyebrow text-ember">{label}</span>}
      <div className="flex gap-1.5">
        {cells.map((cell) => (
          <span
            key={cell.unit}
            className="flex min-w-11 items-baseline justify-center gap-0.5 bg-ink px-2 py-1.5 text-peach"
          >
            <span className="font-display text-xl font-bold tabular-nums">
              {String(cell.value).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-ember">{cell.unit}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
