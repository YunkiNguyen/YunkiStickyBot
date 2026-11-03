import {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  MessageFlags
} from "discord.js";

import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import { fileURLToPath, pathToFileURL } from "url";

import { joinSavedVoiceChannel, scheduleFastRejoin } from "./utils/voiceConnection.js";
import { loadVoice, getVoiceChannel } from "./utils/voiceStore.js";
import { resumeGiveaways } from "./utils/giveawayService.js";
import { DATA_DIR } from "./utils/jsonStore.js";
import { describeHealth, describeLiveness } from "./utils/health.js";
import { cmdlineLooksLikeBot, readProcessCmdline } from "./utils/processLock.js";

// =====================================================
// PATH
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// CONFIG
// =====================================================

const PORT = Number(process.env.PORT) || 3001;

// =====================================================
// PROCESS LOCK - YUNKI BOT
// =====================================================

const LOCK_FILE = path.join(__dirname, ".yunki-bot.lock");

function isProcessRunning(pid) {
  if (!pid || pid === process.pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "EPERM") {
      return true;
    }
    return false;
  }
}

function isOurBotProcess(pid) {
  if (!isProcessRunning(pid)) return false;

  const cmdline = readProcessCmdline(pid);
  // Không đọc được /proc: giữ hành vi cũ (PID còn sống thì coi là đang chạy).
  if (cmdline == null) return true;
  return cmdlineLooksLikeBot(cmdline);
}

function acquireProcessLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const raw = fs.readFileSync(LOCK_FILE, "utf8");
      const oldLock = JSON.parse(raw);

      const sameHost = oldLock?.host === os.hostname();

      if (oldLock && oldLock.pid && oldLock.pid !== process.pid) {
        if (sameHost && isOurBotProcess(oldLock.pid)) {
          console.error("");
          console.error("========================================");
          console.error("       YUNKI BOT ALREADY RUNNING");
          console.error("========================================");
          console.error(`PID đang chạy: ${oldLock.pid}`);
          console.error(`PID hiện tại: ${process.pid}`);
          console.error(`Started: ${oldLock.startedAt || "Unknown"}`);
          console.error("Không khởi động thêm process.");
          console.error("========================================");
          console.error("");
          process.exit(1);
        }

        console.log(`STALE LOCK FOUND: PID ${oldLock.pid}`);
        try {
          fs.unlinkSync(LOCK_FILE);
        } catch {}
      }
    } catch {
      console.log("INVALID LOCK FILE - REMOVING...");
      try {
        fs.unlinkSync(LOCK_FILE);
      } catch {}
    }
  }

  try {
    fs.writeFileSync(
      LOCK_FILE,
      JSON.stringify(
        {
          pid: process.pid,
          host: os.hostname(),
          startedAt: new Date().toISOString()
        },
        null,
        2
      ),
      {
        encoding: "utf8",
        flag: "wx"
      }
    );
    console.log(`PROCESS LOCK ACQUIRED: PID ${process.pid}`);
  } catch (error) {
    if (error.code === "EEXIST") {
      console.error("");
      console.error("YUNKI BOT IS ALREADY STARTING/RUNNING.");
      console.error("Process hiện tại sẽ tự thoát.");
      console.error("");
      process.exit(1);
    }
    throw error;
  }
}

function releaseProcessLock() {
  try {
    if (!fs.existsSync(LOCK_FILE)) return;
    const raw = fs.readFileSync(LOCK_FILE, "utf8");
    const lock = JSON.parse(raw);
    if (lock?.pid === process.pid) {
      fs.unlinkSync(LOCK_FILE);
      console.log("PROCESS LOCK RELEASED");
    }
  } catch {
    // ignore
  }
}

acquireProcessLock();
process.once("exit", releaseProcessLock);

if (!process.env.DATA_DIR) {
  console.warn("");
  console.warn("CẢNH BÁO: chưa đặt DATA_DIR.");
  console.warn(`Dữ liệu đang nằm ở ${DATA_DIR} và có thể mất khi publish lại.`);
  console.warn("Hãy chạy Reserved VM (không Autoscale) và trỏ DATA_DIR tới ổ bền.");
  console.warn("");
} else {
  console.log(`DATA DIR: ${DATA_DIR}`);
}

let discordReady = false;

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  releaseProcessLock();
  process.exit(1);
});
process.once("SIGINT", () => {
  console.log("\nSHUTTING DOWN YUNKI BOT...");
  releaseProcessLock();
  process.exit(0);
});
process.once("SIGTERM", () => {
  console.log("\nTERMINATING YUNKI BOT...");
  releaseProcessLock();
  process.exit(0);
});

// =====================================================
// HEALTH SERVER
// =====================================================

const healthServer = http.createServer((req, res) => {
  const url = req.url?.split("?")[0];

  if (url === "/live") {
    const live = describeLiveness();
    res.writeHead(live.statusCode, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    res.end(live.body);
    return;
  }

  if (url === "/" || url === "/healthz" || url === "/ready") {
    const health = describeHealth(discordReady);
    res.writeHead(health.statusCode, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    res.end(health.body);
    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end("Not Found");
});

healthServer.on("error", (error) => {
  console.error("HEALTH SERVER ERROR:");
  console.error(error);
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} đang được sử dụng.`);
  }
});

healthServer.listen(PORT, "0.0.0.0", () => {
  console.log(`HEALTH SERVER: http://0.0.0.0:${PORT}`);
});

// =====================================================
// CLIENT
// =====================================================

const client = new Client({
  // Bot chỉ dùng slash command + REST + voice nên không cần
  // GuildMessages / MessageContent (privileged) / GuildMessageReactions.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ],
  // Mặc định chỉ cho phép ping user; không bao giờ ping @everyone/@here/role
  // từ nội dung do người dùng nhập. Nơi cần ping user khai báo allowedMentions riêng.
  allowedMentions: { parse: ["users"], repliedUser: false }
});

client.commands = new Collection();

// =====================================================
// COMMAND LOADER
// =====================================================

async function loadCommands(directory) {
  if (!fs.existsSync(directory)) {
    console.log("COMMANDS DIRECTORY NOT FOUND");
    return;
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await loadCommands(fullPath);
      continue;
    }

    if (!entry.name.endsWith(".js") || entry.name.startsWith("_")) {
      continue;
    }

    try {
      const fileUrl = pathToFileURL(fullPath).href;
      const commandModule = await import(fileUrl);
      const command = commandModule.default;

      if (!command || !command.data || !command.execute) {
        console.log(`INVALID COMMAND: ${fullPath}`);
        continue;
      }

      client.commands.set(command.data.name, command);
      console.log(`LOADED COMMAND: /${command.data.name}`);
    } catch (error) {
      console.error(`FAILED TO LOAD: ${fullPath}`);
      console.error(error);
    }
  }
}

async function resumeVoiceConnections() {
  try {
    const entries = Object.entries(loadVoice());

    console.log(`CHECKING VOICE CHANNELS: ${entries.length}`);

    // Chạy song song để nhiều server không phải đợi nhau.
    await Promise.allSettled(
      entries.map(([guildId, channelId]) =>
        joinSavedVoiceChannel(client, guildId, channelId, "AUTO")
      )
    );
  } catch (error) {
    console.error("FAILED TO RESUME VOICE CONNECTIONS", error);
  }
}

// =====================================================
// READY
// =====================================================

client.once(Events.ClientReady, async (readyClient) => {
  discordReady = true;
  console.log("");
  console.log("========================================");
  console.log("          YUNKI BOT ONLINE");
  console.log("========================================");
  console.log(`BOT: ${readyClient.user.tag}`);
  console.log(`SERVERS: ${readyClient.guilds.cache.size}`);
  console.log(`PING: ${readyClient.ws.ping} ms`);
  console.log(`COMMANDS: ${client.commands.size}`);
  console.log(`HEALTH PORT: ${PORT}`);
  console.log(`PROCESS PID: ${process.pid}`);
  console.log("========================================");
  console.log("");

  await resumeGiveaways(client);
  await resumeVoiceConnections();
});

client.on(Events.ShardReady, () => {
  discordReady = true;
});

client.on(Events.ShardResume, () => {
  discordReady = true;
});

client.on(Events.ShardDisconnect, () => {
  discordReady = false;
  console.warn("DISCORD SHARD DISCONNECTED — /healthz sẽ trả 503 cho đến khi kết nối lại.");
});

// =====================================================
// VOICE STATE - backup khi Discord báo bot out
// =====================================================

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    if (!client.user) return;
    if (oldState.id !== client.user.id) return;

    if (oldState.channelId && !newState.channelId) {
      const savedChannelId = getVoiceChannel(oldState.guild.id);

      if (!savedChannelId) return;

      console.log(
        `BOT DISCONNECTED FROM VOICE: ${oldState.guild.name} -> rejoin`
      );
      scheduleFastRejoin(oldState.guild.id, client);
    }
  } catch (error) {
    console.error("VOICE STATE UPDATE ERROR", error);
  }
});

// =====================================================
// DISCORD ERRORS
// =====================================================

client.on(Events.Error, (error) => {
  console.error("DISCORD CLIENT ERROR");
  console.error(error);
});

client.on(Events.Warn, (message) => {
  console.warn(`DISCORD WARNING: ${message}`);
});

// =====================================================
// INTERACTION HANDLER
// =====================================================

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log(`COMMAND NOT FOUND: /${interaction.commandName}`);
    try {
      await interaction.reply({
        content: "❌ Command này chưa được tải.",
        flags: MessageFlags.Ephemeral
      });
    } catch {}
    return;
  }

  console.log(
    `COMMAND: /${interaction.commandName} | USER: ${interaction.user.tag} | ID: ${interaction.id}`
  );

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`COMMAND ERROR: /${interaction.commandName}`);
    console.error(error);

    const errorMessage = "❌ Đã xảy ra lỗi khi thực hiện command.";

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      console.error("FAILED TO SEND ERROR RESPONSE");
      console.error(replyError);
    }
  }
});

// =====================================================
// START BOT
// =====================================================

async function startBot() {
  try {
    console.log("STARTING YUNKI BOT...");
    console.log("LOADING COMMANDS...");

    await loadCommands(path.join(__dirname, "commands"));

    console.log("");
    console.log(`COMMANDS LOADED: ${client.commands.size}`);
    console.log("");

    const token = process.env.DISCORD_TOKEN;

    if (!token) {
      console.error("DISCORD_TOKEN NOT FOUND");
      console.error("Please add DISCORD_TOKEN to Replit Secrets.");
      process.exit(1);
    }

    console.log("LOGIN TO DISCORD...");
    await client.login(token);
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("       YUNKI BOT STARTUP ERROR");
    console.error("========================================");
    console.error(error);
    console.error("========================================");
    process.exit(1);
  }
}

startBot();
