import {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  ChannelType
} from "discord.js";

import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath, pathToFileURL } from "url";
import {
  joinVoiceChannel,
  getVoiceConnection
} from "@discordjs/voice";

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

const LOCK_FILE = path.join(
  __dirname,
  ".yunki-bot.lock"
);

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

function acquireProcessLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const raw = fs.readFileSync(LOCK_FILE, "utf8");
      const oldLock = JSON.parse(raw);

      if (
        oldLock &&
        oldLock.pid &&
        oldLock.pid !== process.pid
      ) {
        if (isProcessRunning(oldLock.pid)) {
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
    } catch (error) {
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
    if (!fs.existsSync(LOCK_FILE)) {
      return;
    }

    const raw = fs.readFileSync(LOCK_FILE, "utf8");
    const lock = JSON.parse(raw);

    if (lock?.pid === process.pid) {
      fs.unlinkSync(LOCK_FILE);
      console.log("PROCESS LOCK RELEASED");
    }
  } catch (error) {
    // Không để cleanup làm crash bot
  }
}

acquireProcessLock();

process.once("exit", releaseProcessLock);

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
  if (req.url === "/" || req.url === "/healthz") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    res.end("Yunki Bot is online");
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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();

// Debounce auto-rejoin khi bị kick
const voiceRejoinTimers = new Map();

// =====================================================
// COMMAND LOADER
// =====================================================

async function loadCommands(directory) {
  if (!fs.existsSync(directory)) {
    console.log("COMMANDS DIRECTORY NOT FOUND");
    return;
  }

  const entries = fs.readdirSync(directory, {
    withFileTypes: true
  });

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

      const commandName = command.data.name;
      client.commands.set(commandName, command);
      console.log(`LOADED COMMAND: /${commandName}`);
    } catch (error) {
      console.error(`FAILED TO LOAD: ${fullPath}`);
      console.error(error);
    }
  }
}

// =====================================================
// GIVEAWAY SCHEDULER
// =====================================================

const MAX_TIMEOUT = 2147483647;
const giveawayTimers = new Map();

function clearGiveawayTimer(messageId) {
  const timer = giveawayTimers.get(messageId);

  if (timer) {
    clearTimeout(timer);
    giveawayTimers.delete(messageId);
  }
}

async function scheduleGiveaway(messageId, endTime) {
  clearGiveawayTimer(messageId);

  const remaining = endTime - Date.now();

  if (remaining <= 0) {
    try {
      const { endGiveaway } = await import("./commands/utility/giveaway.js");
      await endGiveaway(client, messageId);
    } catch (error) {
      console.error(`FAILED TO END GIVEAWAY: ${messageId}`);
      console.error(error);
    }

    return;
  }

  const delay = Math.min(remaining, MAX_TIMEOUT);

  const timer = setTimeout(() => {
    scheduleGiveaway(messageId, endTime);
  }, delay);

  giveawayTimers.set(messageId, timer);

  console.log(
    `SCHEDULED GIVEAWAY: ${messageId} | ${Math.ceil(remaining / 1000)}s remaining`
  );
}

async function resumeGiveaways() {
  try {
    const { loadGiveaways } = await import("./utils/giveawayStore.js");
    const { endGiveaway } = await import("./commands/utility/giveaway.js");

    const giveaways = loadGiveaways();
    const entries = Object.entries(giveaways);

    console.log(`CHECKING GIVEAWAYS: ${entries.length}`);

    for (const [messageId, giveaway] of entries) {
      if (!giveaway || giveaway.ended === true) {
        continue;
      }

      if (Number(giveaway.endTime) <= Date.now()) {
        console.log(`AUTO END GIVEAWAY: ${messageId}`);
        await endGiveaway(client, messageId);
        continue;
      }

      await scheduleGiveaway(messageId, giveaway.endTime);
      console.log(`RESUMED GIVEAWAY: ${messageId}`);
    }
  } catch (error) {
    console.error("FAILED TO RESUME GIVEAWAYS", error);
  }
}

// =====================================================
// VOICE HELPERS
// =====================================================

async function joinSavedVoiceChannel(guildId, channelId, reason = "AUTO") {
  try {
    const { removeVoiceChannel } = await import("./utils/voiceStore.js");

    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      console.log(`VOICE SKIP: Guild ${guildId} not found`);
      removeVoiceChannel(guildId);
      return false;
    }

    const channel = guild.channels.cache.get(channelId);

    if (
      !channel ||
      (channel.type !== ChannelType.GuildVoice &&
        channel.type !== ChannelType.GuildStageVoice)
    ) {
      console.log(`VOICE SKIP: Channel ${channelId} invalid`);
      removeVoiceChannel(guildId);
      return false;
    }

    const me = guild.members.me;
    const permissions = channel.permissionsFor(me);

    if (!permissions?.has(["Connect", "ViewChannel"])) {
      console.log(`VOICE SKIP: Missing permissions in ${channel.name}`);
      return false;
    }

    // Đã ở đúng kênh rồi thì thôi
    if (me?.voice?.channelId === channel.id) {
      return true;
    }

    const existing = getVoiceConnection(guildId);
    if (existing) {
      existing.destroy();
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    connection.on("error", (error) => {
      console.error(`Voice connection error (${guildId}):`, error);
    });

    console.log(`${reason} JOIN VOICE: ${channel.name} (${guild.name})`);
    return true;
  } catch (error) {
    console.error(`FAILED TO JOIN VOICE: ${guildId}`, error);
    return false;
  }
}

async function resumeVoiceConnections() {
  try {
    const { loadVoice } = await import("./utils/voiceStore.js");
    const saved = loadVoice();
    const entries = Object.entries(saved);

    console.log(`CHECKING VOICE CHANNELS: ${entries.length}`);

    for (const [guildId, channelId] of entries) {
      await joinSavedVoiceChannel(guildId, channelId, "AUTO");
    }
  } catch (error) {
    console.error("FAILED TO RESUME VOICE CONNECTIONS", error);
  }
}

function scheduleVoiceRejoin(guildId, channelId) {
  const oldTimer = voiceRejoinTimers.get(guildId);
  if (oldTimer) {
    clearTimeout(oldTimer);
  }

  const timer = setTimeout(async () => {
    voiceRejoinTimers.delete(guildId);

    try {
      const { getVoiceChannel } = await import("./utils/voiceStore.js");
      const savedChannelId = getVoiceChannel(guildId);

      // Đã /leave thì không join lại
      if (!savedChannelId) {
        return;
      }

      await joinSavedVoiceChannel(guildId, savedChannelId, "REJOIN");
    } catch (error) {
      console.error(`FAILED TO REJOIN AFTER KICK: ${guildId}`, error);
    }
  }, 1500);

  voiceRejoinTimers.set(guildId, timer);
}

// =====================================================
// READY
// =====================================================

client.once(Events.ClientReady, async (readyClient) => {
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

  // Không tự đăng ký Global Commands ở đây nữa.
  // Chỉ dùng `npm run deploy` để tránh bị trùng lệnh.

  await resumeGiveaways();
  await resumeVoiceConnections();
});

// =====================================================
// VOICE STATE - tự join lại nếu bị kick (không dùng /leave)
// =====================================================

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    if (!client.user) return;
    if (oldState.id !== client.user.id) return;

    // Bot bị disconnect / kick ra khỏi voice
    if (oldState.channelId && !newState.channelId) {
      const { getVoiceChannel } = await import("./utils/voiceStore.js");
      const savedChannelId = getVoiceChannel(oldState.guild.id);

      // Không có trong store = đã /leave chủ động
      if (!savedChannelId) {
        return;
      }

      console.log(
        `BOT DISCONNECTED FROM VOICE: ${oldState.guild.name} -> will rejoin`
      );

      scheduleVoiceRejoin(oldState.guild.id, savedChannelId);
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
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log(`COMMAND NOT FOUND: /${interaction.commandName}`);

    try {
      await interaction.reply({
        content: "❌ Command này chưa được tải.",
        ephemeral: true
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
        await interaction.followUp({
          content: errorMessage,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true
        });
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
