// SPDX-License-Identifier: GPL-3.0-or-later

import {
  WORKFLOW_CHANNELS,
  buildChannelKeyboard,
  buildMainMenuKeyboard,
  buildReleaseConfirmKeyboard,
  buildStatusKeyboard,
  constantTimeEqual,
  escapeHtml,
  helpMessage,
  isAuthorizedChat,
  isAuthorizedUser,
  parseBuildArgs,
  parseReleaseTag,
  parseSlashCommand,
} from "./commands.ts";
import type { Env, WorkflowChannel } from "./commands.ts";
import {
  createReleaseTag,
  dispatchModuleBuild,
  getStatusReport,
  getUpstreamReport,
  previewReleaseTag,
} from "./github.ts";
import { callTelegram, editHtml, sendHtml } from "./telegram.ts";

interface TelegramUser {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

async function handleMessage(env: Env, msg: TelegramMessage, isChannelPost: boolean): Promise<void> {
  if (isChannelPost) {
    // Only channel admins can post channel messages; check the channel ID allowlist.
    if (!isAuthorizedChat(msg.chat.id, env.ALLOWED_TELEGRAM_CHAT_IDS)) {
      return;
    }
  } else if (!isAuthorizedUser(msg.from?.id, env.ALLOWED_TELEGRAM_USER_IDS)) {
    await sendHtml(env.TELEGRAM_BOT_TOKEN, msg.chat.id, "Unauthorized user.");
    return;
  }

  const parsed = parseSlashCommand(msg.text);
  if (!parsed) return;

  switch (parsed.command) {
    case "start":
    case "help":
      await sendHtml(env.TELEGRAM_BOT_TOKEN, msg.chat.id, helpMessage(), buildMainMenuKeyboard());
      return;

    case "build": {
      if (parsed.args.length === 0) {
        await sendHtml(
          env.TELEGRAM_BOT_TOKEN,
          msg.chat.id,
          "Select the upstream <code>thtbee/nectarlink</code> channel(s) to bundle into the module pre-release:",
          buildChannelKeyboard(),
        );
        return;
      }
      const res = parseBuildArgs(parsed.args);
      if (!res.ok) {
        await sendHtml(env.TELEGRAM_BOT_TOKEN, msg.chat.id, escapeHtml(res.error));
        return;
      }
      const dispatched = await dispatchModuleBuild(env, res.channel, res.version);
      await sendHtml(
        env.TELEGRAM_BOT_TOKEN,
        msg.chat.id,
        [
          "🚀 <b>Dispatched Build Flashable Module</b>",
          `• <b>Channel(s):</b> <code>${escapeHtml(dispatched.channel)}</code>`,
          `• <b>Version:</b> <code>${escapeHtml(dispatched.version)}</code>`,
          `• <b>Pre-release tag:</b> <code>${escapeHtml(dispatched.releaseTag)}</code>`,
        ].join("\n"),
        buildStatusKeyboard(
          dispatched.actionsUrl,
          `https://github.com/${env.MODULE_REPO}/releases/tag/${encodeURIComponent(dispatched.releaseTag)}`,
        ),
      );
      return;
    }

    case "release": {
      const parsedTag = parseReleaseTag(parsed.args);
      if (!parsedTag.ok) {
        await sendHtml(env.TELEGRAM_BOT_TOKEN, msg.chat.id, escapeHtml(parsedTag.error));
        return;
      }
      const preview = await previewReleaseTag(env, parsedTag.tag);
      if (preview.exists) {
        await sendHtml(
          env.TELEGRAM_BOT_TOKEN,
          msg.chat.id,
          `⚠️ Tag <code>${escapeHtml(preview.tag)}</code> already exists on <code>${escapeHtml(env.MODULE_REPO)}</code>.`,
        );
        return;
      }
      await sendHtml(
        env.TELEGRAM_BOT_TOKEN,
        msg.chat.id,
        [
          `<b>Confirm GitHub Release Tag</b>`,
          `• <b>Tag:</b> <code>${escapeHtml(preview.tag)}</code>`,
          `• <b>Target commit:</b> <code>${escapeHtml(preview.sha.slice(0, 7))}</code> (${escapeHtml(preview.commitMessage)})`,
          "",
          "Pushing this tag triggers <code>build.yml</code> and creates a public GitHub Release.",
        ].join("\n"),
        buildReleaseConfirmKeyboard(preview.tag),
      );
      return;
    }

    case "status": {
      const report = await getStatusReport(env);
      await sendHtml(
        env.TELEGRAM_BOT_TOKEN,
        msg.chat.id,
        report.html,
        buildStatusKeyboard(report.actionsUrl, report.releaseUrl),
      );
      return;
    }

    case "upstream": {
      const report = await getUpstreamReport(env);
      await sendHtml(
        env.TELEGRAM_BOT_TOKEN,
        msg.chat.id,
        report.html,
        buildStatusKeyboard(report.actionsUrl, report.releaseUrl),
      );
      return;
    }

    default:
      await sendHtml(env.TELEGRAM_BOT_TOKEN, msg.chat.id, helpMessage(), buildMainMenuKeyboard());
  }
}

async function handleCallback(env: Env, cb: TelegramCallbackQuery): Promise<void> {
  if (!isAuthorizedUser(cb.from.id, env.ALLOWED_TELEGRAM_USER_IDS)) {
    await callTelegram(env.TELEGRAM_BOT_TOKEN, "answerCallbackQuery", {
      callback_query_id: cb.id,
      text: "Unauthorized user.",
      show_alert: true,
    });
    return;
  }

  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  const data = cb.data ?? "";
  await callTelegram(env.TELEGRAM_BOT_TOKEN, "answerCallbackQuery", { callback_query_id: cb.id });
  if (!chatId || !messageId) return;

  if (data === "menu:cancel") {
    await editHtml(env.TELEGRAM_BOT_TOKEN, chatId, messageId, "Cancelled.");
    return;
  }

  if (data === "menu:build") {
    await editHtml(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      messageId,
      "Select the upstream <code>thtbee/nectarlink</code> channel(s) to bundle into the module pre-release:",
      buildChannelKeyboard(),
    );
    return;
  }

  if (data === "status:refresh") {
    const report = await getStatusReport(env);
    await editHtml(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      messageId,
      report.html,
      buildStatusKeyboard(report.actionsUrl, report.releaseUrl),
    );
    return;
  }

  if (data === "upstream:refresh") {
    const report = await getUpstreamReport(env);
    await editHtml(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      messageId,
      report.html,
      buildStatusKeyboard(report.actionsUrl, report.releaseUrl),
    );
    return;
  }

  if (data.startsWith("build:")) {
    const [, rawChannel, rawVer] = data.split(":");
    if (!(WORKFLOW_CHANNELS as readonly string[]).includes(rawChannel)) {
      await editHtml(env.TELEGRAM_BOT_TOKEN, chatId, messageId, `Unknown channel: <code>${escapeHtml(rawChannel)}</code>`);
      return;
    }
    const dispatched = await dispatchModuleBuild(env, rawChannel as WorkflowChannel, rawVer || null);
    await editHtml(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      messageId,
      [
        "🚀 <b>Dispatched Build Flashable Module</b>",
        `• <b>Channel(s):</b> <code>${escapeHtml(dispatched.channel)}</code>`,
        `• <b>Version:</b> <code>${escapeHtml(dispatched.version)}</code>`,
        `• <b>Pre-release tag:</b> <code>${escapeHtml(dispatched.releaseTag)}</code>`,
      ].join("\n"),
      buildStatusKeyboard(
        dispatched.actionsUrl,
        `https://github.com/${env.MODULE_REPO}/releases/tag/${encodeURIComponent(dispatched.releaseTag)}`,
      ),
    );
    return;
  }

  if (data.startsWith("rel_ok:")) {
    const tag = data.slice("rel_ok:".length);
    const created = await createReleaseTag(env, tag);
    await editHtml(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      messageId,
      [
        `🏷️ <b>Created release tag <code>${escapeHtml(created.tag)}</code></b>`,
        `• <b>Commit:</b> <code>${escapeHtml(created.sha.slice(0, 7))}</code> (${escapeHtml(created.commitMessage)})`,
        `• <code>build.yml</code> is now building the GitHub Release.`,
      ].join("\n"),
      buildStatusKeyboard(
        `https://github.com/${env.MODULE_REPO}/actions/workflows/${env.WORKFLOW_FILE}`,
        `https://github.com/${env.MODULE_REPO}/releases/tag/${encodeURIComponent(created.tag)}`,
      ),
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response("nectarlink-release-bot ok", { status: 200 });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const headerSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (!env.TELEGRAM_WEBHOOK_SECRET || !constantTimeEqual(headerSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
      return new Response("Forbidden", { status: 403 });
    }

    let update: TelegramUpdate;
    try {
      update = (await request.json()) as TelegramUpdate;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    try {
      if (update.message) {
        await handleMessage(env, update.message, false);
      } else if (update.channel_post) {
        await handleMessage(env, update.channel_post, true);
      } else if (update.callback_query) {
        await handleCallback(env, update.callback_query);
      }
    } catch (err) {
      const msgText = err instanceof Error ? err.message : String(err);
      const chatId =
        update.message?.chat.id ??
        update.channel_post?.chat.id ??
        update.callback_query?.message?.chat.id;
      if (chatId && env.TELEGRAM_BOT_TOKEN) {
        await sendHtml(env.TELEGRAM_BOT_TOKEN, chatId, `❌ <b>Error:</b> <code>${escapeHtml(msgText)}</code>`).catch(
          () => undefined,
        );
      }
    }

    return new Response("ok", { status: 200 });
  },
};
