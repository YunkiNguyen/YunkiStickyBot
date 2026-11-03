import {
  REST,
  Routes
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import config from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ Thiếu DISCORD_TOKEN trong Replit Secrets.");
  process.exit(1);
}

if (!config.botId) {
  console.error("❌ Hãy điền botId trong config.js hoặc CLIENT_ID trong Secrets.");
  process.exit(1);
}

// Những lệnh dùng được trong DM với bot. Mọi lệnh khác chỉ dùng trong server
// (các lệnh đó đọc interaction.guild nên sẽ lỗi nếu gọi từ DM).
const DM_OK = new Set(["ping", "status", "help", "config"]);

const commands = [];

for (const folder of ["moderation", "utility"]) {
  const folderPath = path.join(__dirname, "commands", folder);
  const files = fs
    .readdirSync(folderPath)
    .filter(file => file.endsWith(".js"));

  for (const file of files) {
    const command = (
      await import(
        pathToFileURL(path.join(folderPath, file)).href
      )
    ).default;

    if (command?.data) {
      const json = command.data.toJSON();

      if (!DM_OK.has(json.name)) {
        json.contexts = [0]; // 0 = Guild
      }

      commands.push(json);
    }
  }
}

const rest = new REST({ version: "10" }).setToken(token);

console.log(`📦 Tổng số commands: ${commands.length}`);
console.log("🚀 Đang đăng ký Slash Commands...");

try {
  // Dọn lệnh cũ của một guild (ví dụ server test cũ) để không bị trùng lệnh
  // với Global Commands. Đặt CLEAR_GUILD_ID=<id> khi chạy deploy một lần.
  const clearGuildId = process.env.CLEAR_GUILD_ID;

  if (clearGuildId && clearGuildId !== config.guildId) {
    console.log(`🧹 Đang xóa Guild Commands cũ của ${clearGuildId}...`);
    await rest.put(
      Routes.applicationGuildCommands(config.botId, clearGuildId),
      { body: [] }
    );
  }

  if (config.guildId) {
    // Chế độ TEST: chỉ đăng ký cho một server.
    await rest.put(
      Routes.applicationGuildCommands(config.botId, config.guildId),
      { body: commands }
    );

    console.log(`✅ Đăng ký Guild Commands thành công (Guild ID: ${config.guildId}).`);
    console.log("⚠️ Các server khác sẽ KHÔNG có lệnh. Bỏ GUILD_ID để deploy Global.");

    // Chỉ xóa Global khi được yêu cầu rõ ràng (CLEAR_GLOBAL_COMMANDS=1).
    if (process.env.CLEAR_GLOBAL_COMMANDS === "1") {
      await rest.put(Routes.applicationCommands(config.botId), { body: [] });
      console.log("🧹 Đã xóa Global Commands.");
    }
  } else {
    await rest.put(
      Routes.applicationCommands(config.botId),
      { body: commands }
    );

    console.log("✅ Đăng ký Global Commands thành công (mọi server).");
    console.log("ℹ️ Global Commands có thể mất vài phút để cập nhật.");
  }
} catch (error) {
  console.error("❌ Đăng ký command thất bại:", error);
  process.exit(1);
}
