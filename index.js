import {
  Client,
  Collection,
  GatewayIntentBits,
  Events
} from "discord.js";

import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath, pathToFileURL } from "url";

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
// PROCESS LOCK
// =====================================================

const LOCK_FILE = path.join(
  __dirname,
  ".yunki-bot.lock"
);

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireProcessLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      try {
        const oldLock = JSON.parse(
          fs.readFileSync(
            LOCK_FILE,
            "utf8"
          )
        );

        if (
          oldLock?.pid &&
          oldLock.pid !== process.pid &&
          isProcessRunning(oldLock.pid)
        ) {
          console.error("");
          console.error(
            "========================================"
          );
          console.error(
            "       YUNKI BOT ALREADY RUNNING"
          );
          console.error(
            "========================================"
          );
          console.error(
            `PID đang chạy: ${oldLock.pid}`
          );
          console.error(
            "Process hiện tại sẽ tự thoát."
          );
          console.error(
            "========================================"
          );
          console.error("");

          process.exit(1);
        }

        fs.unlinkSync(LOCK_FILE);
      } catch {
        try {
          fs.unlinkSync(LOCK_FILE);
        } catch {}
      }
    }

    fs.writeFileSync(
      LOCK_FILE,
      JSON.stringify(
        {
          pid: process.pid,
          startedAt:
            new Date().toISOString()
        },
        null,
        2
      ),
      {
        flag: "wx"
      }
    );

    console.log(
      `PROCESS LOCK ACQUIRED: PID ${process.pid}`
    );
  } catch (error) {
    if (error.code === "EEXIST") {
      console.error(
        "Một process Yunki Bot khác đang chạy."
      );

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

    const lock = JSON.parse(
      fs.readFileSync(
        LOCK_FILE,
        "utf8"
      )
    );

    if (lock.pid === process.pid) {
      fs.unlinkSync(LOCK_FILE);

      console.log(
        "PROCESS LOCK RELEASED"
      );
    }
  } catch {
    // Không crash khi cleanup
  }
}

acquireProcessLock();

process.once(
  "exit",
  releaseProcessLock
);

process.once(
  "SIGINT",
  () => {
    releaseProcessLock();
    process.exit(0);
  }
);

process.once(
  "SIGTERM",
  () => {
    releaseProcessLock();
    process.exit(0);
  }
);

// =====================================================
// HEALTH SERVER
// =====================================================

const healthServer =
  http.createServer(
    (req, res) => {
      if (
        req.url === "/" ||
        req.url === "/healthz"
      ) {
        res.writeHead(200, {
          "Content-Type":
            "text/plain; charset=utf-8"
        });

        res.end(
          "Yunki Bot is online"
        );

        return;
      }

      res.writeHead(404, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      res.end(
        "Not Found"
      );
    }
  );

healthServer.on(
  "error",
  (error) => {
    console.error(
      "HEALTH SERVER ERROR:"
    );

    console.error(error);

    if (
      error.code === "EADDRINUSE"
    ) {
      console.error(
        `Port ${PORT} đang được sử dụng.`
      );
    }
  }
);

healthServer.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `HEALTH SERVER: http://0.0.0.0:${PORT}`
    );
  }
);

// =====================================================
// CLIENT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.commands =
  new Collection();

// =====================================================
// COMMAND LOADER
// =====================================================

async function loadCommands(
  directory
) {
  if (!fs.existsSync(directory)) {
    console.log(
      "COMMANDS DIRECTORY NOT FOUND"
    );

    return;
  }

  const entries =
    fs.readdirSync(
      directory,
      {
        withFileTypes: true
      }
    );

  for (
    const entry of entries
  ) {
    const fullPath =
      path.join(
        directory,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      await loadCommands(
        fullPath
      );

      continue;
    }

    if (
      !entry.name.endsWith(
        ".js"
      ) ||
      entry.name.startsWith(
        "_"
      )
    ) {
      continue;
    }

    try {
      const fileUrl =
        pathToFileURL(
          fullPath
        ).href;

      const commandModule =
        await import(
          fileUrl
        );

      const command =
        commandModule.default;

      if (
        !command ||
        !command.data ||
        !command.execute
      ) {
        console.log(
          `INVALID COMMAND: ${fullPath}`
        );

        continue;
      }

      const commandName =
        command.data.name;

      client.commands.set(
        commandName,
        command
      );

      console.log(
        `LOADED COMMAND: /${commandName}`
      );
    } catch (error) {
      console.error(
        `FAILED TO LOAD: ${fullPath}`
      );

      console.error(error);
    }
  }
}

// =====================================================
// GIVEAWAY SCHEDULER
// =====================================================

// Node.js setTimeout có giới hạn khoảng 24.8 ngày.
// Giveaway dài hơn mức này phải chia thành nhiều timer.

const MAX_TIMEOUT =
  2147483647;

const giveawayTimers =
  new Map();

function clearGiveawayTimer(
  messageId
) {
  const timer =
    giveawayTimers.get(
      messageId
    );

  if (timer) {
    clearTimeout(timer);

    giveawayTimers.delete(
      messageId
    );
  }
}

async function scheduleGiveaway(
  messageId,
  endTime
) {
  clearGiveawayTimer(
    messageId
  );

  const remaining =
    endTime - Date.now();

  if (remaining <= 0) {
    try {
      const {
        endGiveaway
      } = await import(
        "./commands/utility/giveaway.js"
      );

      await endGiveaway(
        client,
        messageId
      );
    } catch (error) {
      console.error(
        `FAILED TO END GIVEAWAY: ${messageId}`
      );

      console.error(error);
    }

    return;
  }

  const delay =
    Math.min(
      remaining,
      MAX_TIMEOUT
    );

  const timer =
    setTimeout(
      () => {
        scheduleGiveaway(
          messageId,
          endTime
        );
      },
      delay
    );

  giveawayTimers.set(
    messageId,
    timer
  );

  console.log(
    `SCHEDULED GIVEAWAY: ${messageId} | ${Math.ceil(
      remaining / 1000
    )}s remaining`
  );
}

// =====================================================
// RESUME GIVEAWAYS
// =====================================================

async function resumeGiveaways() {
  try {
    const {
      loadGiveaways
    } = await import(
      "./utils/giveawayStore.js"
    );

    const giveaways =
      loadGiveaways();

    const entries =
      Object.entries(
        giveaways
      );

    console.log(
      `CHECKING GIVEAWAYS: ${entries.length}`
    );

    for (
      const [
        messageId,
        giveaway
      ] of entries
    ) {
      if (
        !giveaway ||
        giveaway.ended
      ) {
        continue;
      }

      await scheduleGiveaway(
        messageId,
        giveaway.endTime
      );
    }
  } catch (error) {
    console.error(
      "FAILED TO RESUME GIVEAWAYS"
    );

    console.error(error);
  }
}

// =====================================================
// READY
// =====================================================

client.once(
  Events.ClientReady,
  async (
    readyClient
  ) => {
    console.log("");

    console.log(
      "========================================"
    );

    console.log(
      "          YUNKI BOT ONLINE"
    );

    console.log(
      "========================================"
    );

    console.log(
      `BOT: ${readyClient.user.tag}`
    );

    console.log(
      `SERVERS: ${readyClient.guilds.cache.size}`
    );

    console.log(
      `PING: ${readyClient.ws.ping} ms`
    );

    console.log(
      `COMMANDS: ${client.commands.size}`
    );

    console.log(
      `HEALTH PORT: ${PORT}`
    );

    console.log(
      `PROCESS PID: ${process.pid}`
    );

    console.log(
      "========================================"
    );

    console.log("");

    // =================================================
    // REGISTER COMMANDS
    // =================================================

    try {
      const commands = [];

      for (
        const command
        of client.commands.values()
      ) {
        commands.push(
          command.data.toJSON()
        );
      }

      await readyClient
        .application
        .commands
        .set(commands);

      console.log(
        `REGISTERED COMMANDS: ${commands.length}`
      );
    } catch (error) {
      console.error(
        "FAILED TO REGISTER SLASH COMMANDS"
      );

      console.error(error);
    }

    // =================================================
    // RESUME GIVEAWAYS
    // =================================================

    await resumeGiveaways();
  }
);

// =====================================================
// DISCORD ERRORS
// =====================================================

client.on(
  Events.Error,
  (error) => {
    console.error(
      "DISCORD CLIENT ERROR"
    );

    console.error(error);
  }
);

client.on(
  Events.Warn,
  (message) => {
    console.warn(
      `DISCORD WARNING: ${message}`
    );
  }
);

// =====================================================
// INTERACTION HANDLER
// =====================================================

client.on(
  Events.InteractionCreate,
  async (
    interaction
  ) => {
    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    const command =
      client.commands.get(
        interaction.commandName
      );

    if (!command) {
      console.log(
        `COMMAND NOT FOUND: /${interaction.commandName}`
      );

      try {
        await interaction.reply({
          content:
            "❌ Command này chưa được tải.",
          ephemeral: true
        });
      } catch {}

      return;
    }

    console.log(
      `COMMAND: /${interaction.commandName} | USER: ${interaction.user.tag} | ID: ${interaction.id}`
    );

    try {
      await command.execute(
        interaction,
        client
      );
    } catch (error) {
      console.error(
        `COMMAND ERROR: /${interaction.commandName}`
      );

      console.error(error);

      const errorMessage =
        "❌ Đã xảy ra lỗi khi thực hiện command.";

      try {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp({
            content:
              errorMessage,
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content:
              errorMessage,
            ephemeral: true
          });
        }
      } catch (
        replyError
      ) {
        console.error(
          "FAILED TO SEND ERROR RESPONSE"
        );

        console.error(
          replyError
        );
      }
    }
  }
);

// =====================================================
// START BOT
// =====================================================

async function startBot() {
  try {
    console.log(
      "STARTING YUNKI BOT..."
    );

    console.log(
      "LOADING COMMANDS..."
    );

    await loadCommands(
      path.join(
        __dirname,
        "commands"
      )
    );

    console.log("");

    console.log(
      `COMMANDS LOADED: ${client.commands.size}`
    );

    console.log("");

    const token =
      process.env.DISCORD_TOKEN;

    if (!token) {
      console.error(
        "DISCORD_TOKEN NOT FOUND"
      );

      console.error(
        "Please add DISCORD_TOKEN to Replit Secrets."
      );

      process.exit(1);
    }

    console.log(
      "LOGIN TO DISCORD..."
    );

    await client.login(
      token
    );
  } catch (error) {
    console.error("");

    console.error(
      "========================================"
    );

    console.error(
      "       YUNKI BOT STARTUP ERROR"
    );

    console.error(
      "========================================"
    );

    console.error(error);

    console.error(
      "========================================"
    );

    process.exit(1);
  }
}

startBot();