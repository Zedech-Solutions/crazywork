"use client";

import { useEffect } from "react";

// Renders the real Instagram post via the official embed.js (no API key needed
// for public posts). The script auto-processes blockquotes on load; for ones
// added afterwards we call process() ourselves.
declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const SCRIPT_ID = "instagram-embed-js";

export function InstagramEmbed({
  url,
  caption,
}: {
  url: string;
  caption?: string | null;
}) {
  useEffect(() => {
    if (window.instgrm) {
      window.instgrm.Embeds.process();
      return;
    }
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = "https://www.instagram.com/embed.js";
      document.body.appendChild(script);
    }
  }, [url]);

  // No data-instgrm-captioned → the post frame renders with the caption
  // collapsed (image + header + action bar only).
  return (
    <blockquote
      className="instagram-media"
      data-instgrm-permalink={url}
      data-instgrm-version="14"
      style={{ margin: 0, width: "100%", minWidth: 0, border: 0 }}
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        {caption ?? "View on Instagram"}
      </a>
    </blockquote>
  );
}
