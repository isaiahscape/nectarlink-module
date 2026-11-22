// SPDX-License-Identifier: GPL-3.0-or-later

import type { Env, WorkflowChannel } from "./commands.ts";
import { escapeHtml, formatRunStatusIcon } from "./commands.ts";

interface WorkflowRun {
  id: number;
  name: string;
  display_title?: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_branch: string;
  head_sha: string;
  created_at: string;
}

interface ReleaseAsset {
  name: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  target_commitish: string;
  published_at: string;
  html_url: string;
  assets: ReleaseAsset[];
}

async function ghFetch<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const baseHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "nectarlink-release-bot/0.1",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(init?.headers ?? {}),
  };
  let res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...baseHeaders,
      Authorization: `Bearer ${env.GITHUB_TOKEN.trim()}`,
    },
  });
  // Fine-grained PATs scoped to MODULE_REPO return 403 on other owners' public repos; retry without auth.
  if (
    res.status === 403 &&
    (!init?.method || init.method === "GET") &&
    !path.startsWith(`/repos/${env.MODULE_REPO}/`)
  ) {
    res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: baseHeaders,
    });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} on ${path}: ${body.slice(0, 240)}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

async function ghExists(env: Env, path: string): Promise<boolean> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN.trim()}`,
      "User-Agent": "nectarlink-release-bot/0.1",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  return res.ok;
}

export async function resolveBaseVersion(env: Env): Promise<string> {
  try {
    const releases = await ghFetch<GitHubRelease[]>(env, `/repos/${env.UPSTREAM_REPO}/releases?per_page=15`);
    const nightly = releases.find((r) => !r.draft && r.prerelease && /^v\d+\.\d+\.\d+-nightly\.\d+$/.test(r.tag_name));
    if (nightly) {
      const m = /^v(\d+\.\d+\.\d+)-nightly\./.exec(nightly.tag_name);
      if (m) return m[1];
    }
  } catch {
    // Fallback below if upstream API lookup fails transiently.
  }
  return "0.1.6";
}

export interface DispatchResult {
  version: string;
  channel: WorkflowChannel;
  releaseTag: string;
  actionsUrl: string;
}

export async function dispatchModuleBuild(
  env: Env,
  channel: WorkflowChannel,
  explicitVersion: string | null,
): Promise<DispatchResult> {
  const version = explicitVersion ?? (await resolveBaseVersion(env));
  const releaseTag = `v${version}-nightly`;
  await ghFetch<void>(
    env,
    `/repos/${env.MODULE_REPO}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: env.DEFAULT_BRANCH,
        inputs: {
          services_ref: env.DEFAULT_BRANCH,
          nectarlink_channel: channel,
          version,
          create_prerelease: true,
          release_tag: releaseTag,
        },
      }),
    },
  );
  return {
    version,
    channel,
    releaseTag,
    actionsUrl: `https://github.com/${env.MODULE_REPO}/actions/workflows/${env.WORKFLOW_FILE}`,
  };
}

export interface TagPreview {
  tag: string;
  exists: boolean;
  sha: string;
  commitMessage: string;
}

export async function previewReleaseTag(env: Env, tag: string): Promise<TagPreview> {
  const [exists, branch] = await Promise.all([
    ghExists(env, `/repos/${env.MODULE_REPO}/git/ref/tags/${encodeURIComponent(tag)}`),
    ghFetch<{ commit: { sha: string; commit: { message: string } } }>(
      env,
      `/repos/${env.MODULE_REPO}/branches/${encodeURIComponent(env.DEFAULT_BRANCH)}`,
    ),
  ]);
  return {
    tag,
    exists,
    sha: branch.commit.sha,
    commitMessage: branch.commit.commit.message.split("\n")[0] ?? "",
  };
}

export async function createReleaseTag(env: Env, tag: string): Promise<TagPreview> {
  const preview = await previewReleaseTag(env, tag);
  if (preview.exists) {
    throw new Error(`Tag ${tag} already exists on ${env.MODULE_REPO}.`);
  }
  await ghFetch<unknown>(env, `/repos/${env.MODULE_REPO}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `refs/tags/${tag}`,
      sha: preview.sha,
    }),
  });
  return preview;
}

async function latestWorkflowRun(env: Env, repo: string, workflow: string, branch?: string): Promise<WorkflowRun | null> {
  const qs = new URLSearchParams({ per_page: "1" });
  if (branch) qs.set("branch", branch);
  const data = await ghFetch<{ workflow_runs: WorkflowRun[] }>(
    env,
    `/repos/${repo}/actions/workflows/${workflow}/runs?${qs.toString()}`,
  );
  return data.workflow_runs[0] ?? null;
}

function formatRunLine(label: string, run: WorkflowRun | null): string {
  if (!run) return `• <b>${escapeHtml(label)}:</b> none`;
  const icon = formatRunStatusIcon(run.status, run.conclusion);
  const state = run.status === "completed" ? (run.conclusion ?? "completed") : run.status;
  return `• <b>${escapeHtml(label)}:</b> ${icon} <a href="${escapeHtml(run.html_url)}">${escapeHtml(state)}</a> (<code>${escapeHtml(run.head_sha.slice(0, 7))}</code>)`;
}

export async function getStatusReport(env: Env): Promise<{ html: string; actionsUrl: string; releaseUrl?: string }> {
  const [modBuild, modLint, modReleases, upCi, upCanary, upReleases] = await Promise.all([
    latestWorkflowRun(env, env.MODULE_REPO, env.WORKFLOW_FILE),
    latestWorkflowRun(env, env.MODULE_REPO, "lint.yml", env.DEFAULT_BRANCH),
    ghFetch<GitHubRelease[]>(env, `/repos/${env.MODULE_REPO}/releases?per_page=5`).catch(() => [] as GitHubRelease[]),
    latestWorkflowRun(env, env.UPSTREAM_REPO, "ci.yml", "main"),
    latestWorkflowRun(env, env.UPSTREAM_REPO, "canary.yml"),
    ghFetch<GitHubRelease[]>(env, `/repos/${env.UPSTREAM_REPO}/releases?per_page=15`).catch(() => [] as GitHubRelease[]),
  ]);

  const modPre = modReleases.find((r) => !r.draft && r.prerelease) ?? modReleases[0];
  const upCanaryRel = upReleases.find((r) => !r.draft && r.tag_name === "canary");
  const upNightlyRel = upReleases.find((r) => !r.draft && r.prerelease && /^v\d+\.\d+\.\d+-nightly\.\d+$/.test(r.tag_name));
  const upStableRel = upReleases.find((r) => !r.draft && !r.prerelease);

  const lines = [
    `<b>${escapeHtml(env.MODULE_REPO)}</b>`,
    formatRunLine("Build", modBuild),
    formatRunLine("Lint", modLint),
    modPre
      ? `• <b>Pre-release:</b> <a href="${escapeHtml(modPre.html_url)}">${escapeHtml(modPre.tag_name)}</a> (${modPre.assets.length} assets)`
      : "• <b>Pre-release:</b> none",
    "",
    `<b>${escapeHtml(env.UPSTREAM_REPO)}</b>`,
    formatRunLine("CI (main)", upCi),
    formatRunLine("Canary workflow", upCanary),
    `• <b>Canary release:</b> <code>${escapeHtml(upCanaryRel?.name || "none")}</code>`,
    `• <b>Nightly release:</b> <code>${escapeHtml(upNightlyRel?.tag_name || "none")}</code>`,
    `• <b>Stable release:</b> <code>${escapeHtml(upStableRel?.tag_name || "none")}</code>`,
  ];

  return {
    html: lines.join("\n"),
    actionsUrl: `https://github.com/${env.MODULE_REPO}/actions`,
    releaseUrl: modPre?.html_url,
  };
}

export async function getUpstreamReport(env: Env): Promise<{ html: string; actionsUrl: string; releaseUrl?: string }> {
  const [upCi, upCanary, upNightly, upReleases] = await Promise.all([
    latestWorkflowRun(env, env.UPSTREAM_REPO, "ci.yml", "main"),
    latestWorkflowRun(env, env.UPSTREAM_REPO, "canary.yml"),
    latestWorkflowRun(env, env.UPSTREAM_REPO, "nightly.yml"),
    ghFetch<GitHubRelease[]>(env, `/repos/${env.UPSTREAM_REPO}/releases?per_page=15`).catch(() => [] as GitHubRelease[]),
  ]);

  const upCanaryRel = upReleases.find((r) => !r.draft && r.tag_name === "canary");
  const upNightlyRel = upReleases.find((r) => !r.draft && r.prerelease && /^v\d+\.\d+\.\d+-nightly\.\d+$/.test(r.tag_name));
  const upStableRel = upReleases.find((r) => !r.draft && !r.prerelease);

  const lines = [
    `<b>Upstream: ${escapeHtml(env.UPSTREAM_REPO)}</b>`,
    formatRunLine("CI (main)", upCi),
    formatRunLine("Canary workflow", upCanary),
    formatRunLine("Nightly workflow", upNightly),
    "",
    `• <b>Canary:</b> ${upCanaryRel ? `<a href="${escapeHtml(upCanaryRel.html_url)}">${escapeHtml(upCanaryRel.name)}</a>` : "none"}`,
    `• <b>Nightly:</b> ${upNightlyRel ? `<a href="${escapeHtml(upNightlyRel.html_url)}">${escapeHtml(upNightlyRel.tag_name)}</a>` : "none"}`,
    `• <b>Stable:</b> ${upStableRel ? `<a href="${escapeHtml(upStableRel.html_url)}">${escapeHtml(upStableRel.tag_name)}</a>` : "none"}`,
  ];

  return {
    html: lines.join("\n"),
    actionsUrl: `https://github.com/${env.UPSTREAM_REPO}/actions`,
    releaseUrl: upCanaryRel?.html_url ?? upNightlyRel?.html_url ?? upStableRel?.html_url,
  };
}
