"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

// Scroll-driven parallax for the full-bleed hero image. The image container is
// oversized (±15% beyond the section) so the vertical drift never reveals an
// edge. Lives in its own client component so the home page stays server-rendered.
export function HeroParallax({ src, alt }: { src: string; alt: string }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 110]);
  const scale = useTransform(scrollY, [0, 700], [1, 1.08]);

  return (
    <motion.div
      style={{ y, scale }}
      className="absolute -inset-y-[15%] inset-x-0 will-change-transform"
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-90"
      />
    </motion.div>
  );
}
