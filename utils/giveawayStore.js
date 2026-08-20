import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE = path.join(__dirname, "../data/giveaways.json");

function init() {
  if (!fs.existsSync(FILE)) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, "{}", "utf8");
  }
}

export function loadGiveaways() {
  init();

  try {
    const raw = fs.readFileSync(FILE, "utf8").trim();
    if (!raw) return {};

    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};
  } catch (error) {
    console.error("[GIVEAWAY STORE] Không thể đọc giveaways.json:", error);
    return {};
  }
}

export function saveGiveaways(data) {
  init();

  const tempFile = `${FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempFile, FILE);
}

export function getGiveaway(id) {
  const data = loadGiveaways();
  return data[id];
}

export function setGiveaway(id, value) {
  const data = loadGiveaways();
  data[id] = value;
  saveGiveaways(data);
}

export function removeGiveaway(id) {
  const data = loadGiveaways();
  delete data[id];
  saveGiveaways(data);
}
