"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

// Scroll-triggered reveal: fades + rises into view once. Wrap any section or
// grid item. Pass `delay` (or `index`) for staggered reveals.
//
// Only `transform` (y/scale) and `opacity` are animated — these are
// compositor-friendly so the reveal stays smooth even when many fire at once on
// a fast scroll. Animated `filter: blur()` was removed because it repaints on
// the main thread every frame and was the source of scroll jank.
export function Reveal({
  children,
  className,
  delay = 0,
  index,
  y = 48,
  as = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  index?: number;
  y?: number;
  as?: "div" | "section" | "li" | "article";
} & Omit<HTMLMotionProps<"div">, "ref">) {
  const Comp = motion[as] as typeof motion.div;
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <Comp className={className} {...rest}>
        {children}
      </Comp>
    );
  }

  // Cap the stagger tight so flicking to the bottom doesn't queue a long
  // cascade of late reveals.
  const computedDelay = index != null ? Math.min(index * 0.06, 0.24) : delay;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.55,
        delay: computedDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
