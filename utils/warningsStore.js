import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE = path.join(__dirname, "../data/warnings.json");

function init() {
  if (!fs.existsSync(FILE)) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, "{}", "utf8");
  }
}

export function loadWarnings() {
  init();

  try {
    const raw = fs.readFileSync(FILE, "utf8").trim();
    if (!raw) return {};

    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};
  } catch (error) {
    console.error("[WARNINGS STORE] Không thể đọc warnings.json:", error);
    return {};
  }
}

export function saveWarnings(data) {
  init();

  const tempFile = `${FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempFile, FILE);
}

export function getUserWarnings(guildId, userId) {
  const data = loadWarnings();
  return Array.isArray(data[guildId]?.[userId])
    ? data[guildId][userId]
    : [];
}

export function addWarning(guildId, userId, warning) {
  const data = loadWarnings();

  if (!data[guildId] || typeof data[guildId] !== "object") {
    data[guildId] = {};
  }

  if (!Array.isArray(data[guildId][userId])) {
    data[guildId][userId] = [];
  }

  data[guildId][userId].push(warning);
  saveWarnings(data);

  return data[guildId][userId];
}
