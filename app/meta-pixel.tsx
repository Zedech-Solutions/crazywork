"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type PixelWindow = Window & {
  fbq?: (...args: unknown[]) => void;
};

export default function MetaPixel() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const pixel = (window as PixelWindow).fbq;

    if (!ready || !pathname || !pixel) return;
    if (lastPath.current === pathname) return;

    pixel("track", "PageView");
    lastPath.current = pathname;
  }, [pathname, ready]);

  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      onReady={() => setReady(true)}
    >
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '2603495410071933');
      `}
    </Script>
  );
}
