import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSuperadminSession } from "@/lib/admin-guard";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { ConfirmProvider } from "@/components/admin/confirm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "Admin", template: "%s · CRAZYWORK Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // server-side guard on every /admin/* route — admins use their own login,
  // separate from the customer /auth/* flow
  const session = await getSuperadminSession(await headers());
  if (!session) redirect("/admin/login");

  return (
    <ConfirmProvider>
      <div className="admin-scope flex h-screen gap-3 overflow-hidden bg-sand/50 p-3 lg:p-4">
      {/* SIDEBAR — rounded dark dashboard rail */}
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="flex h-full flex-col rounded-2xl bg-ink p-5 text-peach">
          <Link href="/admin" className="block">
            <span className="headline block text-xl tracking-[0.15em]">
              CRAZYWORK
            </span>
            <span className="eyebrow mt-0.5 block text-ember">Admin</span>
          </Link>
          <AdminNav />
          <Link
            href="/"
            className="mt-6 block rounded-lg px-3 py-2 text-xs text-peach/50 transition-colors hover:bg-peach/10 hover:text-ember"
          >
            ← Back to store
          </Link>
        </div>
      </aside>

      {/* CONTENT — header fixed, only the main body scrolls */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <header className="flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-peach px-5 py-3 shadow-sm ring-1 ring-warmgrey/40">
          <div className="flex items-center gap-2">
            <AdminMobileNav />
            <Link href="/admin" className="subhead text-sm md:hidden">
              CRAZYWORK ADMIN
            </Link>
            <span className="hidden eyebrow text-brown md:block">
              Control panel
            </span>
          </div>
          <AdminUserMenu email={session.user.email} />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-peach p-6 shadow-sm ring-1 ring-warmgrey/40 lg:p-8">
          {children}
        </main>
      </div>
      </div>
    </ConfirmProvider>
  );
}
