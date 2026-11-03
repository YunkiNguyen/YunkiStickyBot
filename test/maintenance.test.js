import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "yunki-data-"));

const { describeHealth, describeLiveness } = await import("../utils/health.js");
const { parseDuration } = await import("../utils/duration.js");
const { cmdlineLooksLikeBot } = await import("../utils/processLock.js");
const { readJsonObject, writeJsonObject, dataFile } = await import("../utils/jsonStore.js");
const warnings = await import("../utils/warningsStore.js");

test("health is 503 until Discord is ready, then 200", () => {
  assert.deepEqual(describeHealth(false), {
    statusCode: 503,
    body: "Yunki Bot is not ready"
  });
  assert.deepEqual(describeHealth(true), {
    statusCode: 200,
    body: "Yunki Bot is online"
  });
  assert.equal(describeLiveness().statusCode, 200);
});

test("parseDuration accepts compound units and rejects junk", () => {
  assert.equal(parseDuration("10m"), 600_000);
  assert.equal(parseDuration("1h30m"), 5_400_000);
  assert.equal(parseDuration(" 7d "), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseDuration(""), null);
  assert.equal(parseDuration("abc"), null);
  assert.equal(parseDuration("0s"), null);
  assert.equal(parseDuration("1x"), null);
});

test("cmdline lock only matches the bot process", () => {
  assert.equal(cmdlineLooksLikeBot("node\u0000index.js"), true);
  assert.equal(cmdlineLooksLikeBot("/usr/bin/node index.js"), true);
  assert.equal(cmdlineLooksLikeBot("python other.py"), false);
  assert.equal(cmdlineLooksLikeBot(""), false);
});

test("corrupt JSON is renamed instead of overwritten", () => {
  const file = dataFile("sample.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{not json", "utf8");

  const data = readJsonObject(file, "TEST");
  assert.deepEqual(data, {});
  assert.equal(fs.existsSync(file), false);

  const backups = fs
    .readdirSync(path.dirname(file))
    .filter(name => name.startsWith("sample.json.corrupt-"));
  assert.equal(backups.length, 1);

  writeJsonObject(file, { ok: true });
  assert.deepEqual(readJsonObject(file, "TEST"), { ok: true });
});

test("warnings can be added and removed without touching other users", () => {
  const guild = "g-test";
  const user = "u-test";
  const other = "u-other";

  warnings.addWarning(guild, user, { reason: "a", moderator: "mod", timestamp: 1 });
  warnings.addWarning(guild, user, { reason: "b", moderator: "mod", timestamp: 2 });
  warnings.addWarning(guild, other, { reason: "keep", moderator: "mod", timestamp: 3 });

  const once = warnings.removeWarnings(guild, user, 1);
  assert.equal(once.removed.length, 1);
  assert.equal(once.removed[0].reason, "b");
  assert.equal(once.remaining.length, 1);

  const cleared = warnings.removeWarnings(guild, user, Infinity);
  assert.equal(cleared.removed.length, 1);
  assert.equal(cleared.remaining.length, 0);
  assert.deepEqual(warnings.getUserWarnings(guild, user), []);
  assert.equal(warnings.getUserWarnings(guild, other).length, 1);

  const missing = warnings.removeWarnings(guild, "nobody", 1);
  assert.equal(missing.removed.length, 0);
});
