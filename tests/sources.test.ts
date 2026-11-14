import test from "node:test";
import assert from "node:assert/strict";
import {
  APPLICATION_SOURCE_GROUPS,
  ALL_PRESET_SOURCES,
  matchPresetSource,
} from "../src/shared/api.ts";

test("application source groups contain all user-requested platforms and channels", () => {
  const sources = ALL_PRESET_SOURCES;

  // Specific job boards
  assert.ok(sources.includes("LinkedIn"), "Should include LinkedIn");
  assert.ok(sources.includes("Naukri"), "Should include Naukri");
  assert.ok(sources.includes("Internshala"), "Should include Internshala");
  assert.ok(sources.includes("Wellfound"), "Should include Wellfound");
  assert.ok(sources.includes("Indeed"), "Should include Indeed");
  assert.ok(sources.includes("Glassdoor"), "Should include Glassdoor");

  // Portals and general boards
  assert.ok(sources.includes("Job board"), "Should include Job board");
  assert.ok(sources.includes("Career portal"), "Should include Career portal");
  assert.ok(sources.includes("Company website"), "Should include Company website");

  // Messaging channels
  assert.ok(sources.includes("WhatsApp channels"), "Should include WhatsApp channels");
  assert.ok(sources.includes("Telegram channels"), "Should include Telegram channels");

  // Outreach & network
  assert.ok(sources.includes("Referral"), "Should include Referral");
  assert.ok(sources.includes("Recruiter outreach"), "Should include Recruiter outreach");
});

test("matchPresetSource handles exact and case-insensitive matches", () => {
  assert.equal(matchPresetSource("LinkedIn"), "LinkedIn");
  assert.equal(matchPresetSource("linkedin"), "LinkedIn");
  assert.equal(matchPresetSource("Naukri"), "Naukri");
  assert.equal(matchPresetSource("naukri"), "Naukri");
  assert.equal(matchPresetSource("Internshala"), "Internshala");
  assert.equal(matchPresetSource("internshala"), "Internshala");
  assert.equal(matchPresetSource("Wellfound"), "Wellfound");
  assert.equal(matchPresetSource("wellfound"), "Wellfound");
  assert.equal(matchPresetSource("WhatsApp channels"), "WhatsApp channels");
  assert.equal(matchPresetSource("Telegram channels"), "Telegram channels");
  assert.equal(matchPresetSource("Career portal"), "Career portal");
  assert.equal(matchPresetSource("Job board"), "Job board");
});

test("matchPresetSource handles common phonetic variants and synonyms", () => {
  // User phonetic spelling 'Nokri'
  assert.equal(matchPresetSource("Nokri"), "Naukri");
  assert.equal(matchPresetSource("nokri"), "Naukri");
  assert.equal(matchPresetSource("naukri.com"), "Naukri");

  // Channel variants
  assert.equal(matchPresetSource("WhatsApp"), "WhatsApp channels");
  assert.equal(matchPresetSource("whatsapp channel"), "WhatsApp channels");
  assert.equal(matchPresetSource("Telegram"), "Telegram channels");
  assert.equal(matchPresetSource("telegram channel"), "Telegram channels");

  // Career portal variants
  assert.equal(matchPresetSource("Careers portal"), "Career portal");
  assert.equal(matchPresetSource("career page"), "Career portal");

  // AngelList / Wellfound
  assert.equal(matchPresetSource("AngelList"), "Wellfound");
});

test("matchPresetSource preserves unknown custom sources as null (custom)", () => {
  assert.equal(matchPresetSource("Campus fair"), null);
  assert.equal(matchPresetSource("Hackathon 2026"), null);
  assert.equal(matchPresetSource(""), null);
  assert.equal(matchPresetSource(null), null);
  assert.equal(matchPresetSource(undefined), null);
});
