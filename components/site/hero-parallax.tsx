"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Media } from "@/components/site/media";

// Scroll-driven parallax for the full-bleed hero media (image or video). The
// container is oversized (±15% beyond the section) so the vertical drift never
// reveals an edge. Client component so the home page stays server-rendered.
export function HeroParallax({ src, alt }: { src: string; alt: string }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 110]);
  const scale = useTransform(scrollY, [0, 700], [1, 1.08]);

  return (
    <motion.div
      style={{ y, scale }}
      className="absolute -inset-y-[15%] inset-x-0 will-change-transform"
    >
      <Media
        src={src}
        alt={alt}
        priority
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover opacity-90"
      />
    </motion.div>
  );
}
