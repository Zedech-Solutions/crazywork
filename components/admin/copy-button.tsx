"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Tiny inline copy-to-clipboard button with a brief "copied" check.
export function CopyButton({
  value,
  label,
  size = 13,
  iconOnly = false,
}: {
  value: string;
  label?: string;
  size?: number;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        aria-label={label ? `Copy ${label}` : "Copy"}
        title={copied ? "Copied" : `Copy ${label ?? ""}`.trim()}
        onClick={copy}
        className="inline-flex shrink-0 cursor-pointer items-center text-warmgrey transition-colors hover:text-ember"
      >
        {copied ? (
          <Check size={size} className="text-emerald-600" />
        ) : (
          <Copy size={size} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label ? `Copy ${label}` : "Copy"}
      title={copied ? "Copied" : "Copy"}
      onClick={copy}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-warmgrey/60 px-1.5 py-0.5 text-[11px] font-medium text-brown transition-colors hover:border-ember hover:text-ember"
    >
      {copied ? (
        <>
          <Check size={size} className="text-emerald-600" /> Copied
        </>
      ) : (
        <>
          <Copy size={size} /> Copy
        </>
      )}
    </button>
  );
}
