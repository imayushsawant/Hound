import test from "node:test";
import assert from "node:assert/strict";
import { compareSemver, isNewerVersion, checkForUpdate } from "../electron/main/updater.ts";

test("updater semver comparison handles various formats", () => {
  assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
  assert.equal(compareSemver("v1.0.0", "1.0.0"), 0);
  assert.equal(compareSemver("1.0.1", "1.0.0"), 1);
  assert.equal(compareSemver("1.0.0", "1.0.1"), -1);
  assert.equal(compareSemver("1.1.0", "1.0.9"), 1);
  assert.equal(compareSemver("2.0.0", "1.99.99"), 1);
  assert.equal(compareSemver("v1.2.3", "v1.2.4"), -1);
  assert.equal(compareSemver("1.0.0-beta", "1.0.0"), 0);
});

test("isNewerVersion correctly identifies whether an update is available", () => {
  assert.equal(isNewerVersion("1.0.0", "1.0.0"), false);
  assert.equal(isNewerVersion("1.0.0", "v1.0.1"), true);
  assert.equal(isNewerVersion("1.0.0", "1.1.0"), true);
  assert.equal(isNewerVersion("1.1.0", "1.0.9"), false);
  assert.equal(isNewerVersion("2.0.0", "1.9.9"), false);
});

test("checkForUpdate detects new version from mock GitHub API response", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: "v1.1.0",
      name: "Hound v1.1.0 - The New Chapter",
      html_url: "https://github.com/imayushsawant/Hound/releases/tag/v1.1.0",
      body: "## What's Changed\n* Added update notification",
      published_at: "2026-11-15T00:00:00Z",
    }),
  }) as any;

  const result = await checkForUpdate("1.0.0", "imayushsawant/Hound", mockFetch);
  assert.equal(result.updateAvailable, true);
  assert.equal(result.currentVersion, "1.0.0");
  assert.equal(result.latestVersion, "1.1.0");
  assert.equal(result.releaseName, "Hound v1.1.0 - The New Chapter");
  assert.equal(result.releaseUrl, "https://github.com/imayushsawant/Hound/releases/tag/v1.1.0");
});

test("checkForUpdate indicates no update when running same or newer version", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: "v1.0.0",
      name: "Hound v1.0.0",
      html_url: "https://github.com/imayushsawant/Hound/releases/tag/v1.0.0",
      body: "Initial release",
    }),
  }) as any;

  const result = await checkForUpdate("1.0.0", "imayushsawant/Hound", mockFetch);
  assert.equal(result.updateAvailable, false);
  assert.equal(result.latestVersion, "1.0.0");
});

test("checkForUpdate handles network or GitHub API errors gracefully", async () => {
  const mockFailingFetch = async () => {
    throw new Error("Network unreachable");
  };

  const result = await checkForUpdate("1.0.0", "imayushsawant/Hound", mockFailingFetch as any);
  assert.equal(result.updateAvailable, false);
  assert.equal(result.error, "Network unreachable");
});
