import { Hono } from "hono";
import { auth } from "@/lib/auth";
import { admin } from "./routes/admin";
import { storefront } from "./routes/storefront";

export const app = new Hono().basePath("/api");

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));
app.route("/admin", admin);
app.route("/", storefront);

app.notFound((c) => c.json({ ok: false, message: "Not found" }, 404));
