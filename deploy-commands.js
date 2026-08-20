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

if (!config.botId || config.botId === "DAN_ID_BOT_VAO_DAY") {
  console.error("❌ Hãy điền botId trong config.js.");
  process.exit(1);
}

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
      commands.push(command.data.toJSON());
    }
  }
}

const rest = new REST({ version: "10" }).setToken(token);

console.log(`📦 Tổng số commands: ${commands.length}`);
console.log("🚀 Đang đăng ký Slash Commands...");

if (config.guildId && config.guildId !== "DAN_ID_SERVER_VAO_DAY") {
  // Xóa toàn bộ Global Commands cũ.
  // Nếu trước đây bot từng deploy Global Commands,
  // Discord sẽ giữ chúng và có thể hiển thị command bị trùng
  // với Guild Commands.
  console.log("🧹 Đang xóa Global Commands cũ...");

  await rest.put(
    Routes.applicationCommands(config.botId),
    { body: [] }
  );

  console.log("✅ Đã xóa Global Commands cũ.");

  // Đăng ký lại toàn bộ command vào đúng server.
  await rest.put(
    Routes.applicationGuildCommands(config.botId, config.guildId),
    { body: commands }
  );

  console.log("✅ Đăng ký Guild Commands thành công.");
  console.log(`🏠 Guild ID: ${config.guildId}`);
} else {
  await rest.put(
    Routes.applicationCommands(config.botId),
    { body: commands }
  );

  console.log("✅ Đăng ký Global Commands thành công.");
}
