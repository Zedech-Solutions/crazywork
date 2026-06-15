// Next.js global server-error hook. Catches errors thrown in server components,
// pages and route handlers (anything the Hono API onError doesn't already
// handle) and reports them to the Discord error channel.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
): Promise<void> {
  const { reportAppError } = await import("@/lib/integrations/notifier");
  await reportAppError(error, {
    source: "next",
    path: request.path,
    method: request.method,
  });
}
