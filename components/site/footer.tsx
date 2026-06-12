import Link from "next/link";
import { getFooterContent } from "@/lib/content";
import { getSettings } from "@/lib/settings";

const SHOP_LINKS = [
  { href: "/shop", label: "Shop All" },
  { href: "/drops", label: "Drops" },
  { href: "/community", label: "Community" },
  { href: "/collab", label: "Collabs" },
];

const HELP_LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/orders/lookup", label: "Track Order" },
  { href: "/account", label: "Account" },
];

const BRAND_LINKS = [
  { href: "/our-story", label: "Our Story" },
  { href: "/mindset", label: "Mindset" },
  { href: "/blog", label: "Blog" },
];

export async function Footer() {
  const [settings, footer] = await Promise.all([
    getSettings(),
    getFooterContent(),
  ]);
  return (
    <footer className="border-t border-ink bg-ink text-peach">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p className="headline text-4xl tracking-[0.15em]">CRAZYWORK</p>
            <p className="mt-1 eyebrow text-ember">{footer.tagline}</p>
            <p className="mt-5 max-w-xs text-sm text-peach/60">{footer.blurb}</p>
          </div>
          {[
            { title: "Shop", links: SHOP_LINKS },
            { title: "Help", links: HELP_LINKS },
            { title: "Brand", links: BRAND_LINKS },
          ].map((column) => (
            <div key={column.title}>
              <p className="eyebrow mb-4 text-ember">{column.title}</p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-peach/80 hover:text-ember"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-peach/15 pt-6 text-xs text-peach/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} CRAZYWORK
            {settings.ssmNumber ? ` · SSM ${settings.ssmNumber}` : ""} · Malaysia
          </p>
          <div className="flex gap-5">
            {settings.socialInstagram && (
              <a
                href={settings.socialInstagram}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ember"
              >
                Instagram
              </a>
            )}
            {settings.socialTiktok && (
              <a
                href={settings.socialTiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ember"
              >
                TikTok
              </a>
            )}
            {settings.socialEmail && (
              <a href={`mailto:${settings.socialEmail}`} className="hover:text-ember">
                {settings.socialEmail}
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
