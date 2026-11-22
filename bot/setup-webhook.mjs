#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL;
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !webhookUrl || !secretToken) {
  console.error("Usage: TELEGRAM_BOT_TOKEN=... WEBHOOK_URL=https://<worker>.workers.dev TELEGRAM_WEBHOOK_SECRET=... node setup-webhook.mjs");
  process.exit(1);
}

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

await tg("setWebhook", {
  url: webhookUrl,
  secret_token: secretToken,
  allowed_updates: ["message", "channel_post", "callback_query"],
});
console.log("Webhook registered:", webhookUrl);

await tg("setMyCommands", {
  commands: [
    { command: "build", description: "Trigger module pre-release build" },
    { command: "release", description: "Tag & publish a GitHub release (vX.Y.Z)" },
    { command: "status", description: "Check module CI & pre-release status" },
    { command: "upstream", description: "Check thtbee/nectarlink CI & releases" },
    { command: "help", description: "Show bot commands" },
  ],
});
console.log("Bot command menu updated.");
