import {
  Client,
  Collection,
  GatewayIntentBits,
  Events
} from "discord.js";

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// =====================================================
// PATH
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMANDS_PATH = path.join(__dirname, "commands");
const GIVEAWAY_STORE_PATH = path.join(
  __dirname,
  "utils",
  "giveawayStore.js"
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

client.commands = new Collection();

// =====================================================
// COMMAND LOADER
// =====================================================

async function loadCommands(directory) {
  if (!fs.existsSync(directory)) {
    console.error(`COMMANDS DIRECTORY NOT FOUND: ${directory}`);
    return;
  }

  const entries = fs.readdirSync(directory, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    // Load sub-folder
    if (entry.isDirectory()) {
      await loadCommands(fullPath);
      continue;
    }

    // Chỉ load file .js
    if (
      !entry.name.endsWith(".js") ||
      entry.name.startsWith("_")
    ) {
      continue;
    }

    try {
      const fileUrl = pathToFileURL(fullPath).href;
      const commandModule = await import(fileUrl);

      const command = commandModule.default;

      // Kiểm tra command
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

      const commandName = command.data.name;

      // Nếu command trùng tên
      if (client.commands.has(commandName)) {
        console.warn(
          `DUPLICATE COMMAND: /${commandName}`
        );
        continue;
      }

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

const MAX_TIMEOUT = 2_147_483_647;

/**
 * Schedule giveaway end.
 *
 * Node.js setTimeout không hỗ trợ delay quá
 * khoảng 24.8 ngày trong một lần.
 * Vì vậy nếu giveaway dài hơn, bot sẽ chia thành nhiều timer.
 */
function scheduleGiveaway(client, messageId, endTime) {
  const remaining = endTime - Date.now();

  if (remaining <= 0) {
    setImmediate(async () => {
      try {
        const { endGiveaway } = await import(
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
    });

    return;
  }

  const delay = Math.min(
    remaining,
    MAX_TIMEOUT
  );

  setTimeout(() => {
    scheduleGiveaway(
      client,
      messageId,
      endTime
    );
  }, delay);
}

// =====================================================
// RESUME GIVEAWAYS
// =====================================================

async function resumeGiveaways() {
  try {
    const { loadGiveaways } = await import(
      "./utils/giveawayStore.js"
    );

    const giveaways = loadGiveaways();
    const entries = Object.entries(giveaways);

    if (entries.length === 0) {
      console.log("NO GIVEAWAYS TO RESUME");
      return;
    }

    let resumed = 0;
    let expired = 0;

    for (const [messageId, giveaway] of entries) {
      if (!giveaway || giveaway.ended) {
        continue;
      }

      const remaining =
        giveaway.endTime - Date.now();

      // Giveaway đã hết hạn trong lúc bot offline
      if (remaining <= 0) {
        expired++;

        console.log(
          `ENDING EXPIRED GIVEAWAY: ${messageId}`
        );

        try {
          const { endGiveaway } = await import(
            "./commands/utility/giveaway.js"
          );

          await endGiveaway(
            client,
            messageId
          );
        } catch (error) {
          console.error(
            `FAILED TO END EXPIRED GIVEAWAY: ${messageId}`
          );

          console.error(error);
        }

        continue;
      }

      // Giveaway vẫn còn thời gian
      resumed++;

      scheduleGiveaway(
        client,
        messageId,
        giveaway.endTime
      );

      console.log(
        `RESUMED GIVEAWAY: ${messageId} | REMAINING: ${Math.ceil(
          remaining / 1000
        )}s`
      );
    }

    console.log(
      `GIVEAWAYS RESUMED: ${resumed} | EXPIRED: ${expired}`
    );

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
  async (readyClient) => {
    console.log("");
    console.log("========================================");
    console.log("          YUNKI BOT ONLINE");
    console.log("========================================");

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

    console.log("========================================");
    console.log("");

    // =================================================
    // REGISTER SLASH COMMANDS
    // =================================================

    try {
      const commands = [];

      for (
        const command of client.commands.values()
      ) {
        commands.push(
          command.data.toJSON()
        );
      }

      await readyClient.application.commands.set(
        commands
      );

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
// INTERACTION HANDLER
// =====================================================

client.on(
  Events.InteractionCreate,
  async (interaction) => {

    // Chỉ xử lý Slash Commands
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command =
      client.commands.get(
        interaction.commandName
      );

    // =================================================
    // COMMAND NOT FOUND
    // =================================================

    if (!command) {
      console.warn(
        `COMMAND NOT FOUND: /${interaction.commandName}`
      );

      try {
        await interaction.reply({
          content:
            "Command này chưa được tải.",
          ephemeral: true
        });
      } catch (error) {
        console.error(error);
      }

      return;
    }

    console.log(
      `COMMAND: /${interaction.commandName} | USER: ${interaction.user.tag}`
    );

    // =================================================
    // EXECUTE COMMAND
    // =================================================

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
        "Đã xảy ra lỗi khi thực hiện command.";

      try {

        if (
          interaction.replied ||
          interaction.deferred
        ) {

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

        console.error(
          "FAILED TO SEND ERROR RESPONSE"
        );

        console.error(replyError);
      }
    }
  }
);

// =====================================================
// ERROR HANDLERS
// =====================================================

client.on(
  Events.Error,
  (error) => {
    console.error(
      "DISCORD CLIENT ERROR:"
    );

    console.error(error);
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "UNHANDLED PROMISE REJECTION:"
    );

    console.error(error);
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "UNCAUGHT EXCEPTION:"
    );

    console.error(error);
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

    // Load toàn bộ:
    //
    // commands/
    // ├── moderation/
    // └── utility/
    //
    await loadCommands(
      COMMANDS_PATH
    );

    console.log("");

    console.log(
      `COMMANDS LOADED: ${client.commands.size}`
    );

    console.log("");

    // =================================================
    // TOKEN
    // =================================================

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

    // =================================================
    // LOGIN
    // =================================================

    await client.login(token);

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

// =====================================================
// RUN
// =====================================================

startBot();