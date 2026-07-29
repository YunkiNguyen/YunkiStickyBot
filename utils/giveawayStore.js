import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "giveaways.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      "{}",
      "utf8"
    );
  }
}

export function loadGiveaways() {
  ensureFile();

  try {
    const raw = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    if (!raw.trim()) {
      return {};
    }

    const data = JSON.parse(raw);

    if (
      typeof data !== "object" ||
      Array.isArray(data) ||
      data === null
    ) {
      return {};
    }

    return data;
  } catch (error) {
    console.error(
      "❌ Không thể đọc giveaways.json:",
      error
    );

    return {};
  }
}

export function saveGiveaways(data) {
  ensureFile();

  try {
    const tempFile =
      `${DATA_FILE}.tmp`;

    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    fs.renameSync(
      tempFile,
      DATA_FILE
    );
  } catch (error) {
    console.error(
      "❌ Không thể lưu giveaways.json:",
      error
    );
  }
}

export function getGiveaway(messageId) {
  const data = loadGiveaways();

  return data[messageId] || null;
}

export function setGiveaway(
  messageId,
  giveaway
) {
  const data = loadGiveaways();

  data[messageId] = giveaway;

  saveGiveaways(data);

  return giveaway;
}

export function deleteGiveaway(
  messageId
) {
  const data = loadGiveaways();

  delete data[messageId];

  saveGiveaways(data);
}

export function getActiveGiveaways() {
  const data = loadGiveaways();

  return Object.entries(data)
    .filter(([, giveaway]) =>
      giveaway &&
      giveaway.ended !== true
    )
    .map(([messageId, giveaway]) => ({
      messageId,
      ...giveaway
    }));
}