import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Có thể trỏ DATA_DIR tới một thư mục bền (volume / persistent storage).
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "../data");

export function dataFile(name) {
  return path.join(DATA_DIR, name);
}

/**
 * Đọc một file JSON có root là object.
 * - File chưa có -> tạo mới "{}".
 * - File hỏng (JSON lỗi) -> đổi tên thành <file>.corrupt-<timestamp> để KHÔNG bị
 *   ghi đè mất dữ liệu ở lần lưu kế tiếp, rồi trả về {}.
 * - Lỗi đọc khác (quyền, I/O) -> ném lỗi, tránh ghi đè bằng dữ liệu rỗng.
 */
export function readJsonObject(file, label = "STORE") {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "{}", "utf8");
    return {};
  }

  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return {};

  try {
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data;
    }
    throw new Error("Root của JSON không phải object");
  } catch (error) {
    const backup = `${file}.corrupt-${Date.now()}`;
    console.error(`[${label}] File JSON hỏng, đã sao lưu sang: ${backup}`);
    console.error(error);

    try {
      fs.renameSync(file, backup);
    } catch (renameError) {
      console.error(`[${label}] Không thể sao lưu file hỏng:`, renameError);
    }

    return {};
  }
}

export function writeJsonObject(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempFile, file);
}
