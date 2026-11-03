import { dataFile, readJsonObject, writeJsonObject } from "./jsonStore.js";

const FILE = dataFile("warnings.json");

export function loadWarnings() {
  return readJsonObject(FILE, "WARNINGS STORE");
}

export function saveWarnings(data) {
  writeJsonObject(FILE, data);
}

export function getUserWarnings(guildId, userId) {
  const data = loadWarnings();

  if (!Object.hasOwn(data, guildId)) return [];

  const guildData = data[guildId];
  if (!guildData || typeof guildData !== "object") return [];

  return Object.hasOwn(guildData, userId) && Array.isArray(guildData[userId])
    ? guildData[userId]
    : [];
}

export function removeWarnings(guildId, userId, count) {
  const data = loadWarnings();
  const guildData = data[guildId];

  if (!guildData || typeof guildData !== "object" || !Array.isArray(guildData[userId])) {
    return { removed: [], remaining: [] };
  }

  const list = guildData[userId];
  const n = count === Infinity ? list.length : Math.min(Math.max(Number(count) || 0, 0), list.length);
  const removed = n > 0 ? list.splice(list.length - n, n) : [];

  if (list.length === 0) {
    delete guildData[userId];
    if (Object.keys(guildData).length === 0) delete data[guildId];
  }

  saveWarnings(data);
  return { removed, remaining: list };
}

export function addWarning(guildId, userId, warning) {
  const data = loadWarnings();

  if (!Object.hasOwn(data, guildId) || typeof data[guildId] !== "object") {
    data[guildId] = {};
  }

  if (
    !Object.hasOwn(data[guildId], userId) ||
    !Array.isArray(data[guildId][userId])
  ) {
    data[guildId][userId] = [];
  }

  data[guildId][userId].push(warning);
  saveWarnings(data);

  return data[guildId][userId];
}
