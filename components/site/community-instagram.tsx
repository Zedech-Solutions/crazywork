"use client";

import { useEffect, useRef, useState } from "react";
import { InstagramEmbed } from "@/components/site/instagram-embed";

// Wraps the Instagram embed with a skeleton that covers the raw blockquote
// fallback (white card + bare caption) until Instagram swaps in the rendered
// iframe.
export function CommunityInstagram({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // Defer mounting the heavy Instagram iframe until the card nears the viewport.
  // Mounting every embed eagerly made all the iframes load at once on scroll-in,
  // which janked the whole community section.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || mounted) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !mounted) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    // The embed is ready once Instagram replaces the blockquote with an iframe.
    const check = () => {
      const iframe = el.querySelector("iframe");
      if (iframe) {
        // Reveal when the iframe actually loads (it does fire cross-origin) so
        // the clean skeleton stays up until the embed is rendered — not while
        // the iframe is still a blank white box. Long backup in case it doesn't.
        iframe.addEventListener("load", finish, { once: true });
        window.setTimeout(finish, 2500);
        return true;
      }
      return false;
    };
    if (check()) return;
    const obs = new MutationObserver(() => {
      if (check()) obs.disconnect();
    });
    obs.observe(el, { childList: true, subtree: true });
    const fallback = window.setTimeout(finish, 7000);
    return () => {
      obs.disconnect();
      window.clearTimeout(fallback);
    };
  }, [url, mounted]);

  return (
    <div ref={ref} className="relative h-full w-full">
      {/* No caption passed → the loading fallback never flashes the caption text
          (the caption is shown below the card instead). */}
      {mounted && <InstagramEmbed url={url} />}
      {ready && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/95 to-transparent" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ember hover:text-ink"
          >
            View on Instagram →
          </a>
        </>
      )}
      {!ready && (
        <div className="absolute inset-0 z-30 flex animate-pulse flex-col bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-warmgrey/20" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-warmgrey/20" />
              <div className="h-2.5 w-16 rounded bg-warmgrey/15" />
            </div>
          </div>
          <div className="mt-3 flex-1 rounded-lg bg-warmgrey/15" />
          <div className="mt-3 h-3 w-1/2 rounded bg-warmgrey/20" />
        </div>
      )}
    </div>
  );
}
