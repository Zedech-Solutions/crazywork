// Next.js global server-error hook. Catches errors thrown in server components,
// pages and route handlers (anything the Hono API onError doesn't already
// handle) and reports them to the Discord error channel.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
): Promise<void> {
  // The reporter pulls in Node's `crypto` (via secrets). Only load it in the
  // Node runtime so the Edge build of this file never bundles a Node builtin.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportAppError } = await import("@/lib/integrations/notifier");
  await reportAppError(error, {
    source: "next",
    path: request.path,
    method: request.method,
  });
}
