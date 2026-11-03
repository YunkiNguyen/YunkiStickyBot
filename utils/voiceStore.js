import { dataFile, readJsonObject, writeJsonObject } from "./jsonStore.js";

const FILE = dataFile("voice.json");

export function loadVoice() {
  return readJsonObject(FILE, "VOICE STORE");
}

export function saveVoice(data) {
  writeJsonObject(FILE, data);
}

export function getVoiceChannel(guildId) {
  if (!guildId) return null;

  const data = loadVoice();
  return Object.hasOwn(data, guildId) ? data[guildId] || null : null;
}

export function setVoiceChannel(guildId, channelId) {
  const data = loadVoice();
  data[guildId] = channelId;
  saveVoice(data);
}

export function removeVoiceChannel(guildId) {
  if (!guildId) return;

  const data = loadVoice();
  if (!Object.hasOwn(data, guildId)) return;

  delete data[guildId];
  saveVoice(data);
}
