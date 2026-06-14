import { CartProvider } from "@/components/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { WishlistProvider } from "@/components/wishlist/wishlist-context";
import { EmailPopup } from "@/components/site/email-popup";
import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { getSettings } from "@/lib/settings";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  return (
    <CartProvider>
      <WishlistProvider>
      {settings.announcementBar && (
        <p className="bg-ember px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-peach">
          {settings.announcementBar}
        </p>
      )}
      <Navbar />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
      <CartDrawer />
      <EmailPopup delaySeconds={settings.popupDelaySeconds} />
      </WishlistProvider>
    </CartProvider>
  );
}
