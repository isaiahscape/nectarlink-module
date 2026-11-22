// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";
import {
  constantTimeEqual,
  escapeHtml,
  isAuthorizedChat,
  isAuthorizedUser,
  parseBuildArgs,
  parseReleaseTag,
  parseSlashCommand,
} from "../src/commands.ts";

test("parseSlashCommand handles bot suffix and args", () => {
  assert.deepEqual(parseSlashCommand("/build@my_release_bot canary 0.1.6"), {
    command: "build",
    args: ["canary", "0.1.6"],
  });
  assert.equal(parseSlashCommand("hello world"), null);
  assert.equal(parseSlashCommand("/"), null);
});

test("parseBuildArgs accepts channel aliases and optional semver", () => {
  assert.deepEqual(parseBuildArgs([]), {
    ok: true,
    channel: "canary-nightly-and-stable",
    version: null,
  });
  assert.deepEqual(parseBuildArgs(["all", "v0.1.6"]), {
    ok: true,
    channel: "canary-nightly-and-stable",
    version: "0.1.6",
  });
  assert.deepEqual(parseBuildArgs(["canary"]), {
    ok: true,
    channel: "canary",
    version: null,
  });
  assert.equal(parseBuildArgs(["invalid"]).ok, false);
  assert.equal(parseBuildArgs(["stable", "bad-ver"]).ok, false);
});

test("parseReleaseTag normalizes leading v and rejects invalid tags", () => {
  assert.deepEqual(parseReleaseTag(["0.1.6"]), { ok: true, tag: "v0.1.6" });
  assert.deepEqual(parseReleaseTag(["v0.1.6-rc.1"]), { ok: true, tag: "v0.1.6-rc.1" });
  assert.equal(parseReleaseTag([]).ok, false);
  assert.equal(parseReleaseTag(["main"]).ok, false);
});

test("isAuthorizedUser enforces numeric allowlist", () => {
  assert.equal(isAuthorizedUser(123456789, "111, 123456789"), true);
  assert.equal(isAuthorizedUser(999, "111, 123456789"), false);
  assert.equal(isAuthorizedUser(undefined, "123456789"), false);
  assert.equal(isAuthorizedUser(0, "0"), false);
});

test("isAuthorizedChat allows negative channel IDs", () => {
  assert.equal(isAuthorizedChat(-1001234567890, "-1001234567890"), true);
  assert.equal(isAuthorizedChat(-100999, "-1001234567890"), false);
  assert.equal(isAuthorizedChat(0, "0"), false);
  assert.equal(isAuthorizedChat(-1001234567890, undefined), false);
});

test("constantTimeEqual and escapeHtml work as expected", () => {
  assert.equal(constantTimeEqual("secret-123", "secret-123"), true);
  assert.equal(constantTimeEqual("secret-123", "secret-124"), false);
  assert.equal(constantTimeEqual("short", "longer"), false);
  assert.equal(escapeHtml('<script>"a&b"'), "&lt;script&gt;&quot;a&amp;b&quot;");
});
