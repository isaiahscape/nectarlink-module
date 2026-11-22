// SPDX-License-Identifier: GPL-3.0-or-later

import type { InlineKeyboardMarkup } from "./commands.ts";

export async function callTelegram(
  token: string,
  method: "sendMessage" | "editMessageText" | "answerCallbackQuery",
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram ${method} ${res.status}: ${body.slice(0, 240)}`);
  }
}

export async function sendHtml(
  token: string,
  chatId: number,
  html: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  await callTelegram(token, "sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function editHtml(
  token: string,
  chatId: number,
  messageId: number,
  html: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  await callTelegram(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}
