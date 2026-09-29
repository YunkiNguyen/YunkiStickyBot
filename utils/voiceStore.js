import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE = path.join(__dirname, "../data/voice.json");

function init() {
  if (!fs.existsSync(FILE)) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, "{}", "utf8");
  }
}

export function loadVoice() {
  init();

  try {
    const raw = fs.readFileSync(FILE, "utf8").trim();
    if (!raw) return {};

    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};
  } catch (error) {
    console.error("[VOICE STORE] Không thể đọc voice.json:", error);
    return {};
  }
}

export function saveVoice(data) {
  init();

  const tempFile = `${FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempFile, FILE);
}

export function getVoiceChannel(guildId) {
  const data = loadVoice();
  return data[guildId] || null;
}

export function setVoiceChannel(guildId, channelId) {
  const data = loadVoice();
  data[guildId] = channelId;
  saveVoice(data);
}

export function removeVoiceChannel(guildId) {
  const data = loadVoice();
  delete data[guildId];
  saveVoice(data);
}
