import { dataFile, readJsonObject, writeJsonObject } from "./jsonStore.js";

// Lưu trạng thái quyền SendMessages của @everyone TRƯỚC khi /lock,
// để /unlock khôi phục đúng (true / false / null = mặc định).
const FILE = dataFile("locks.json");

export function getLockState(channelId) {
  const data = readJsonObject(FILE, "LOCK STORE");
  return Object.hasOwn(data, channelId) ? data[channelId] : undefined;
}

export function setLockState(channelId, previousValue) {
  const data = readJsonObject(FILE, "LOCK STORE");
  data[channelId] = previousValue;
  writeJsonObject(FILE, data);
}

export function removeLockState(channelId) {
  const data = readJsonObject(FILE, "LOCK STORE");
  if (!Object.hasOwn(data, channelId)) return;

  delete data[channelId];
  writeJsonObject(FILE, data);
}
