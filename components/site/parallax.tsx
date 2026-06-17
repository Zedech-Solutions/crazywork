"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

// Element-scroll parallax background. Place inside a `relative overflow-hidden`
// section; pass a fill child (e.g. <Media>). The inner layer is oversized so the
// drift never reveals an edge. Tracks the section's progress through the viewport.
export function Parallax({
  children,
  className,
  amount = 70,
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [-amount, amount]);

  return (
    <div ref={ref} className={cn("absolute inset-0 overflow-hidden", className)}>
      <motion.div
        style={reduceMotion ? undefined : { y }}
        className="absolute -inset-y-[16%] inset-x-0 will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
