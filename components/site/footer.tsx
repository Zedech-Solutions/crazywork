import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
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
  { href: "/collab", label: "Collab" },
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
        {/* CONTACT — prominent block under the slogan, above the copyright */}
        {(settings.socialInstagram || settings.socialEmail) && (
          <div className="mt-12 border-t border-peach/15 pt-8">
            <p className="eyebrow text-ember">Contact us</p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-10">
              {settings.socialInstagram && (
                <a
                  href={settings.socialInstagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-peach transition-colors hover:text-ember"
                >
                  <Instagram size={22} className="shrink-0" />
                  <span className="text-sm font-medium">
                    {settings.socialInstagramHandle || "Instagram"}
                  </span>
                </a>
              )}
              {settings.socialEmail && (
                <a
                  href={`mailto:${settings.socialEmail}`}
                  className="flex items-center gap-3 text-peach transition-colors hover:text-ember"
                >
                  <Mail size={22} className="shrink-0" />
                  <span className="text-sm font-medium">{settings.socialEmail}</span>
                </a>
              )}
              {settings.socialTiktok && (
                <a
                  href={settings.socialTiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-peach/70 transition-colors hover:text-ember"
                >
                  TikTok
                </a>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col gap-2 border-t border-peach/15 pt-6 text-xs text-peach/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} CRAZYWORK
            {settings.ssmNumber ? ` · SSM ${settings.ssmNumber}` : ""} · Malaysia
          </p>
          <p>
            Developed by{" "}
            <span className="text-peach/70">Zedech Solutions</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
