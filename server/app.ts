import { Hono } from "hono";
import { auth } from "@/lib/auth";
import { reportAppError } from "@/lib/integrations/notifier";
import { admin } from "./routes/admin";
import { cron } from "./routes/cron";
import { storefront } from "./routes/storefront";

export const app = new Hono().basePath("/api");

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));
app.route("/admin", admin);
app.route("/cron", cron);
app.route("/", storefront);

app.notFound((c) => c.json({ ok: false, message: "Not found" }, 404));

// Any uncaught error in an API route is reported to the Discord error channel.
app.onError(async (err, c) => {
  await reportAppError(err, {
    source: "api",
    path: c.req.path,
    method: c.req.method,
  });
  return c.json({ ok: false, message: "Internal server error" }, 500);
});
