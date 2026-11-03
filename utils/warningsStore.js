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
