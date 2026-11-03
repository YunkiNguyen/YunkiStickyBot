const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

// Hỗ trợ "90s", "10m", "1h", "7d" và dạng ghép như "1h30m".
export function parseDuration(value) {
  if (!value) return null;

  const text = String(value).trim().toLowerCase();
  if (!/^(\d+[smhd])+$/.test(text)) return null;

  let total = 0;
  for (const match of text.matchAll(/(\d+)([smhd])/g)) {
    total += Number(match[1]) * UNIT_MS[match[2]];
  }

  return Number.isSafeInteger(total) && total > 0 ? total : null;
}
