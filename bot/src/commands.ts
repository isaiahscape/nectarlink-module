// SPDX-License-Identifier: GPL-3.0-or-later

export interface Env {
  MODULE_REPO: string;
  SERVICES_REPO: string;
  UPSTREAM_REPO: string;
  WORKFLOW_FILE: string;
  DEFAULT_BRANCH: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  GITHUB_TOKEN: string;
  ALLOWED_TELEGRAM_USER_IDS: string;
  ALLOWED_TELEGRAM_CHAT_IDS?: string;
}

export const WORKFLOW_CHANNELS = [
  "canary-nightly-and-stable",
  "nightly-and-stable",
  "canary-and-stable",
  "canary",
  "nightly",
  "stable",
  "none",
] as const;

export type WorkflowChannel = (typeof WORKFLOW_CHANNELS)[number];

const CHANNEL_ALIASES: Record<string, WorkflowChannel> = {
  all: "canary-nightly-and-stable",
  both: "nightly-and-stable",
  "canary-nightly-and-stable": "canary-nightly-and-stable",
  "nightly-and-stable": "nightly-and-stable",
  "canary-and-stable": "canary-and-stable",
  canary: "canary",
  nightly: "nightly",
  stable: "stable",
  none: "none",
  "services-only": "none",
};

const SEMVER_RE = /^v?(\d+\.\d+\.\d+)$/;
const TAG_RE = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

function parseAllowedIds(allowedCsv: string | undefined, pattern: RegExp): Set<string> {
  if (!allowedCsv) return new Set();
  return new Set(
    allowedCsv
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => pattern.test(s)),
  );
}

export function isAuthorizedUser(userId: number | undefined, allowedCsv: string | undefined): boolean {
  if (userId === undefined || !Number.isInteger(userId) || userId <= 0) {
    return false;
  }
  return parseAllowedIds(allowedCsv, /^\d+$/).has(String(userId));
}

export function isAuthorizedChat(chatId: number | undefined, allowedCsv: string | undefined): boolean {
  if (chatId === undefined || !Number.isInteger(chatId) || chatId === 0) {
    return false;
  }
  return parseAllowedIds(allowedCsv, /^-?\d+$/).has(String(chatId));
}

export const BOT_COMMANDS: ReadonlySet<string> = new Set([
  "start",
  "help",
  "build",
  "release",
  "status",
  "upstream",
]);

export interface ParsedCommand {
  command: string;
  args: string[];
}

export function parseSlashCommand(text: string | undefined): ParsedCommand | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const parts = trimmed.split(/\s+/);
  const rawCmd = parts[0].slice(1).split("@")[0].toLowerCase();
  if (!rawCmd) return null;
  return { command: rawCmd, args: parts.slice(1) };
}

export type BuildParseResult =
  | { ok: true; channel: WorkflowChannel; version: string | null }
  | { ok: false; error: string };

export function parseBuildArgs(args: string[]): BuildParseResult {
  if (args.length === 0) {
    return { ok: true, channel: "canary-nightly-and-stable", version: null };
  }
  const ch = CHANNEL_ALIASES[args[0].toLowerCase()];
  if (!ch) {
    return {
      ok: false,
      error: `Unknown channel "${args[0]}". Try: all, canary, nightly, stable, canary-and-stable, nightly-and-stable, or none.`,
    };
  }
  let version: string | null = null;
  if (args.length >= 2) {
    const m = SEMVER_RE.exec(args[1]);
    if (!m) {
      return { ok: false, error: `Invalid version "${args[1]}". Expected X.Y.Z (e.g. 0.1.6).` };
    }
    version = m[1];
  }
  return { ok: true, channel: ch, version };
}

export type ReleaseTagResult = { ok: true; tag: string } | { ok: false; error: string };

export function parseReleaseTag(args: string[]): ReleaseTagResult {
  if (args.length !== 1) {
    return { ok: false, error: "Usage: /release <vX.Y.Z> (for example: /release v0.1.6)" };
  }
  const m = TAG_RE.exec(args[0].trim());
  if (!m) {
    return { ok: false, error: `Invalid release tag "${args[0]}". Expected vX.Y.Z (e.g. v0.1.6).` };
  }
  return { ok: true, tag: `v${m[1]}` };
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineButton[][];
}

export function buildMainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Build Pre-release Menu", callback_data: "menu:build" },
        { text: "Check Status", callback_data: "status:refresh" },
      ],
      [{ text: "Upstream (thtbee/nectarlink)", callback_data: "upstream:refresh" }],
    ],
  };
}

export function buildChannelKeyboard(version?: string | null): InlineKeyboardMarkup {
  const suffix = version ? `:${version}` : "";
  return {
    inline_keyboard: [
      [{ text: "All (canary + nightly + stable)", callback_data: `build:canary-nightly-and-stable${suffix}` }],
      [
        { text: "Canary + Stable", callback_data: `build:canary-and-stable${suffix}` },
        { text: "Nightly + Stable", callback_data: `build:nightly-and-stable${suffix}` },
      ],
      [
        { text: "Canary only", callback_data: `build:canary${suffix}` },
        { text: "Nightly only", callback_data: `build:nightly${suffix}` },
        { text: "Stable only", callback_data: `build:stable${suffix}` },
      ],
      [
        { text: "Services only (no APK)", callback_data: `build:none${suffix}` },
        { text: "Cancel", callback_data: "menu:cancel" },
      ],
    ],
  };
}

export function buildReleaseConfirmKeyboard(tag: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: `Publish ${tag}`, callback_data: `rel_ok:${tag}` },
        { text: "Cancel", callback_data: "menu:cancel" },
      ],
    ],
  };
}

export function buildStatusKeyboard(actionsUrl: string, releaseUrl?: string): InlineKeyboardMarkup {
  const row: InlineButton[] = [{ text: "Refresh", callback_data: "status:refresh" }, { text: "Actions", url: actionsUrl }];
  if (releaseUrl) {
    row.push({ text: "Pre-release", url: releaseUrl });
  }
  return { inline_keyboard: [row] };
}

export function formatRunStatusIcon(status: string, conclusion: string | null): string {
  if (status !== "completed") return "⏳";
  switch (conclusion) {
    case "success":
      return "✅";
    case "failure":
      return "❌";
    case "cancelled":
      return "🚫";
    default:
      return "ℹ️";
  }
}

export function helpMessage(): string {
  return [
    "<b>Nectarlink Module Release Bot</b>",
    "",
    "<b>Commands</b>",
    "• <code>/build</code> — open channel picker for pre-release builds",
    "• <code>/build &lt;channel&gt; [version]</code> — trigger immediately (<code>all</code>, <code>canary</code>, <code>nightly</code>, <code>stable</code>, <code>canary-and-stable</code>, <code>nightly-and-stable</code>, <code>none</code>)",
    "• <code>/release &lt;vX.Y.Z&gt;</code> — confirm and push release tag on <code>main</code>",
    "• <code>/status</code> — show module CI, pre-release assets, and upstream CI",
    "• <code>/upstream</code> — inspect <code>thtbee/nectarlink</code> CI, Canary, Nightly &amp; Stable",
  ].join("\n");
}
