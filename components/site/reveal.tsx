"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

// Scroll-triggered reveal: fades + rises into view once. Wrap any section or
// grid item. Pass `delay` (or `index`) for staggered reveals.
export function Reveal({
  children,
  className,
  delay = 0,
  index,
  y = 28,
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
  const computedDelay = index != null ? Math.min(index * 0.07, 0.5) : delay;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.6,
        delay: computedDelay,
        ease: [0.22, 1, 0.36, 1],
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
