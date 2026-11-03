import { dataFile, readJsonObject, writeJsonObject } from "./jsonStore.js";

const FILE = dataFile("giveaways.json");
const ID_PATTERN = /^\d{17,20}$/;

export function isValidMessageId(id) {
  return typeof id === "string" && ID_PATTERN.test(id);
}

export function loadGiveaways() {
  return readJsonObject(FILE, "GIVEAWAY STORE");
}

export function saveGiveaways(data) {
  writeJsonObject(FILE, data);
}

export function getGiveaway(id) {
  if (!isValidMessageId(id)) return undefined;

  const data = loadGiveaways();
  return Object.hasOwn(data, id) ? data[id] : undefined;
}

export function setGiveaway(id, value) {
  if (!isValidMessageId(id)) {
    throw new Error(`Message ID giveaway không hợp lệ: ${id}`);
  }

  const data = loadGiveaways();
  data[id] = value;
  saveGiveaways(data);
}

export function removeGiveaway(id) {
  if (!isValidMessageId(id)) return;

  const data = loadGiveaways();
  delete data[id];
  saveGiveaways(data);
}
