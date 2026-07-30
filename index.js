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
// DEPLOYMENT / HEALTH SERVER
// =====================================================

const PORT = Number(process.env.PORT) || 3001;

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
    GatewayIntentBits.GuildMessageReactions
  ]
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

    // Only load JavaScript files
    if (
      !entry.name.endsWith(".js") ||
      entry.name.startsWith("_")
    ) {
      continue;
    }

    try {
      const fileUrl =
        pathToFileURL(fullPath).href;

      const commandModule =
        await import(fileUrl);

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
// GIVEAWAY TIMER
// =====================================================

const MAX_TIMEOUT = 2147483647;

function scheduleGiveaway(
  client,
  messageId,
  endTime
) {
  const remaining =
    endTime - Date.now();

  // Giveaway đã hết hạn
  if (remaining <= 0) {
    import(
      "./commands/utility/giveaway.js"
    )
      .then(({ endGiveaway }) => {
        return endGiveaway(
          client,
          messageId
        );
      })
      .catch((error) => {
        console.error(
          `FAILED TO END GIVEAWAY: ${messageId}`
        );

        console.error(error);
      });

    return;
  }

  // Node.js setTimeout không nhận delay
  // lớn hơn 2^31 - 1 ms
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
    const { loadGiveaways } =
      await import(
        "./utils/giveawayStore.js"
      );

    const giveaways =
      loadGiveaways();

    const entries =
      Object.entries(giveaways);

    if (entries.length === 0) {
      console.log("GIVEAWAYS: 0");
      return;
    }

    console.log(
      `CHECKING GIVEAWAYS: ${entries.length}`
    );

    for (
      const [messageId, giveaway]
      of entries
    ) {
      if (
        !giveaway ||
        giveaway.ended
      ) {
        continue;
      }

      scheduleGiveaway(
        client,
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
  async (readyClient) => {
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
      "========================================"
    );
    console.log("");

    // =================================================
    // REGISTER SLASH COMMANDS
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
  async (interaction) => {
    // Chỉ xử lý Slash Command
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

      return interaction.reply({
        content:
          "Command nay chua duoc tai.",
        ephemeral: true
      });
    }

    console.log(
      `COMMAND: /${interaction.commandName} | USER: ${interaction.user.tag}`
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
        "Da xay ra loi khi thuc hien command.";

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

    // =================================================
    // LOGIN
    // =================================================

    console.log(
      "LOGIN TO DISCORD..."
    );

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