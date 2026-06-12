import { auth } from "@/lib/auth";

// Server-side guard for every /admin/* page and /api/admin/* route.
export async function getSuperadminSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session || session.user.role !== "superadmin") return null;
  return session;
}
