import "dotenv/config"; // load .env (DATABASE_URL + AES_MASTER_KEY) first
import { Resend } from "resend";
import { getSecret } from "@/lib/secrets";

// Sends a real test email using the Resend keys saved in the admin panel
// (AES-encrypted in the DB). Usage:
//   npx tsx scripts/test-resend.ts [recipient@example.com]
const TO = process.argv[2] ?? "cheehengtang03@gmail.com";

async function main() {
  const apiKey = await getSecret("resend_api_key");
  // TEST_RESEND_FROM lets you try the sandbox sender (onboarding@resend.dev)
  // without changing the saved From, useful before a domain is verified.
  const from = process.env.TEST_RESEND_FROM ?? (await getSecret("resend_from_email"));

  console.log("Resend config (read from the DB, decrypted):");
  console.log("  api key:", apiKey ? `set (…${apiKey.slice(-4)})` : "✗ MISSING");
  console.log("  from   :", from ?? "✗ MISSING");

  if (!apiKey || !from) {
    console.error(
      "\n✗ Resend isn't fully configured. Set both the API key and From email in\n" +
        "  admin → Settings → Integrations → Resend, then re-run.",
    );
    process.exit(1);
  }

  console.log(`\nSending test email  ${from}  →  ${TO} …`);
  const { data, error } = await new Resend(apiKey).emails.send({
    from,
    to: TO,
    subject: "CRAZYWORK · Resend test ✅",
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
      <p style="font-weight:bold;letter-spacing:2px;font-size:18px">CRAZYWORK</p>
      <h1 style="font-size:22px">Resend is working 🎉</h1>
      <p>If you're reading this in your inbox, transactional email is wired correctly —
      order confirmations, welcome codes and password resets will now send.</p>
      <hr style="border:none;border-top:1px solid #e5ddd0;margin:24px 0" />
      <p style="font-size:12px;color:#7a6a5a">Sent by scripts/test-resend.ts</p>
    </div>`,
  });

  if (error) {
    console.error("\n✗ Resend rejected the send:", error);
    console.error(
      "  Common cause: the From address isn't on a domain you've verified in Resend.\n" +
        "  Quick fix: use onboarding@resend.dev as From and send only to your Resend\n" +
        "  account's own email, or verify your domain (Resend → Domains).",
    );
    process.exit(1);
  }

  console.log(`\n✓ Sent! Resend message id: ${data?.id}`);
  console.log(`  Check the inbox (and spam) for ${TO}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
