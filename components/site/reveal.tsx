"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

// Scroll-triggered reveal: fades + rises into view once. Wrap any section or
// grid item. Pass `delay` (or `index`) for staggered reveals.
export function Reveal({
  children,
  className,
  delay = 0,
  index,
  y = 64,
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
  const computedDelay = index != null ? Math.min(index * 0.1, 0.6) : delay;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y, scale: 0.94, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.85,
        delay: computedDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
