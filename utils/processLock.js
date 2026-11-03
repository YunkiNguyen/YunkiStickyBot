import fs from "fs";

/**
 * Lock cũ chỉ nhìn PID. Trên Replit hostname thường là "repl" và PID được tái sử dụng,
 * nên một lock cũ (kể cả file lỡ commit) có thể chặn bot dù process đó không phải bot.
 * Chỉ coi là "đang chạy" khi cmdline của PID đó thực sự là tiến trình bot.
 */
export function cmdlineLooksLikeBot(cmdline) {
  if (!cmdline) return false;

  const text = String(cmdline).replaceAll("\u0000", " ").toLowerCase();
  return text.includes("index.js");
}

export function readProcessCmdline(pid) {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
  } catch {
    return null;
  }
}
