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

If you want `Build Flashable Module` to post build status and release links to your Telegram DM, group, or **channel** whenever a scheduled, tagged, or manual build finishes:

1. For a **Telegram Channel**: add your bot as a **Channel Administrator** with **Post Messages** (and **Edit Messages**) permission.
2. Get your channel ID:
   - Public channel: you can use `@your_channel_username` for GitHub Actions `TELEGRAM_CHAT_ID`.
   - Private or numeric channel ID (`-100...`): forward any message from your channel to `@RawDataBot` and copy `forward_from_chat.id`.
3. Add these two repository secrets to `isaiahscape/nectarlink-module`:
   - `TELEGRAM_BOT_TOKEN` — your bot token
   - `TELEGRAM_CHAT_ID` — your channel ID (`-100...` or `@your_channel_username`), group ID, or user ID

## Optional: Run Commands Directly Inside a Channel

If you also want to post `/build`, `/release`, `/status`, or `/upstream` directly in your Telegram channel:

1. Set `ALLOWED_TELEGRAM_CHAT_IDS` on the Worker to your numeric channel ID (`-100...`):
   ```sh
   npx wrangler secret put ALLOWED_TELEGRAM_CHAT_IDS
   ```
2. Keep `ALLOWED_TELEGRAM_USER_IDS` set to your personal Telegram user ID so inline buttons clicked in the channel still verify your user ID.
3. Re-run `npm run setup-webhook` so `"channel_post"` updates are enabled.
