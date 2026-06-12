"use client";

import { useEffect, useState } from "react";
import {
  HomePreview,
  type PreviewModel,
  type PreviewRegion,
} from "@/components/admin/home-preview";
import { DEFAULT_HOME_CONTENT } from "@/lib/content";

export const dynamic = "force-dynamic";

// Live-preview surface embedded by the admin Pages builder. It renders nothing
// sensitive — the authenticated parent editor posts the draft content in, and
// region clicks are posted back so the editor can open the right dialog.
export default function HomePreviewBridge() {
  const [content, setContent] = useState<PreviewModel>({
    ...DEFAULT_HOME_CONTENT,
    announcementBar: "",
  });

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "crazywork:content" && e.data.content) {
        setContent(e.data.content as PreviewModel);
      }
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage(
      { type: "crazywork:ready" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function edit(region: PreviewRegion) {
    window.parent?.postMessage(
      { type: "crazywork:edit", region },
      window.location.origin,
    );
  }

  return <HomePreview content={content} editable onEdit={edit} />;
}
