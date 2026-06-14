import Image from "next/image";
import { isVideo } from "@/lib/media";

// Renders a CMS media value as either an autoplaying muted loop video or a
// Next image. Drop-in for any "fill" image slot — same className/object-fit.
export function Media({
  src,
  alt = "",
  className,
  sizes = "100vw",
  priority,
}: {
  src: string;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (isVideo(src)) {
    return (
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={alt || undefined}
        className={className ?? "absolute inset-0 h-full w-full object-cover"}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className={className}
    />
  );
}
