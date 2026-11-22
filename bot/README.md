# Nectarlink Release Telegram Bot

Cloudflare Worker webhook that lets authorized Telegram users dispatch `Build Flashable Module` pre-release builds, cut tagged GitHub Releases (`v*`), and inspect both `isaiahscape/nectarlink-module` and `thtbee/nectarlink` build status.

## Commands

- `/build` — opens an inline keyboard to pick the bundled `thtbee/nectarlink` APK channel (`all`, `canary-and-stable`, `nightly-and-stable`, `canary`, `nightly`, `stable`, or `none`)
- `/build <channel> [version]` — immediately triggers `build.yml` (for example `/build canary 0.1.6`)
- `/release <vX.Y.Z>` — previews the target `main` commit and asks for inline confirmation before creating tag `vX.Y.Z` (which runs `build.yml` to publish a GitHub Release)
- `/status` — shows `Build Flashable Module`, `Lint`, current pre-release, and `thtbee/nectarlink` CI/releases
- `/upstream` — shows `thtbee/nectarlink` CI, Canary, Nightly, and Stable releases

## Deploy to Cloudflare Workers

1. Install dependencies and verify locally:
   ```sh
   cd bot
   npm install
   npm run check
   ```
2. Deploy the Worker:
   ```sh
   npx wrangler deploy
   ```
3. Configure the required Worker secrets (`GITHUB_TOKEN` needs `actions: write` and `contents: write` on `isaiahscape/nectarlink-module`; get your numeric Telegram user ID from `@userinfobot`):
   ```sh
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put ALLOWED_TELEGRAM_USER_IDS
   ```
4. Register the webhook and `/` command menu with Telegram:
   ```sh
   TELEGRAM_BOT_TOKEN=... \
   WEBHOOK_URL=https://nectarlink-release-bot.<your-subdomain>.workers.dev \
   TELEGRAM_WEBHOOK_SECRET=... \
   npm run setup-webhook
   ```

## Optional: Completion Notifications from GitHub Actions

If you want `Build Flashable Module` to message Telegram when any scheduled, tagged, or manual build finishes, add these two repository secrets to `isaiahscape/nectarlink-module`:

- `TELEGRAM_BOT_TOKEN` — your bot token
- `TELEGRAM_CHAT_ID` — your Telegram user or group chat ID
