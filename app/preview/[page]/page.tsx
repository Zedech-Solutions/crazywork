"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckoutSuccessPreview,
  DropsPreview,
  FooterPreview,
  MindsetPreview,
} from "@/components/admin/page-previews";
import {
  DEFAULT_CHECKOUT_SUCCESS_CONTENT,
  DEFAULT_DROPS_CONTENT,
  DEFAULT_FOOTER_CONTENT,
  DEFAULT_MINDSET_CONTENT,
} from "@/lib/content";

export const dynamic = "force-dynamic";

// Generic live-preview surface for the non-home pages, embedded by the admin
// Pages builder. The parent posts draft content in; region clicks post back.
const REGISTRY: Record<
  string,
  {
    Component: (p: {
      content: never;
      editable?: boolean;
      onEdit?: (r: string) => void;
    }) => React.ReactNode;
    fallback: unknown;
  }
> = {
  mindset: { Component: MindsetPreview as never, fallback: DEFAULT_MINDSET_CONTENT },
  drops: { Component: DropsPreview as never, fallback: DEFAULT_DROPS_CONTENT },
  footer: { Component: FooterPreview as never, fallback: DEFAULT_FOOTER_CONTENT },
  checkoutSuccess: {
    Component: CheckoutSuccessPreview as never,
    fallback: DEFAULT_CHECKOUT_SUCCESS_CONTENT,
  },
};

export default function PagePreviewBridge() {
  const params = useParams();
  const page = String(params.page);
  const entry = REGISTRY[page] ?? REGISTRY.mindset;
  const [content, setContent] = useState<unknown>(entry.fallback);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "crazywork:content" && e.data.content) {
        setContent(e.data.content);
      }
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage(
      { type: "crazywork:ready" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const Component = entry.Component;
  return (
    <Component
      content={content as never}
      editable
      onEdit={(region) =>
        window.parent?.postMessage(
          { type: "crazywork:edit", region },
          window.location.origin,
        )
      }
    />
  );
}
