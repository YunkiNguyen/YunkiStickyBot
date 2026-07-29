import {
  SlashCommandBuilder,
  EmbedBuilder
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription(
      "Kiểm tra độ trễ và trạng thái của Yunki Bot."
    ),

  async execute(interaction, client) {
    const botLatency =
      Date.now() -
      interaction.createdTimestamp;

    const apiPing =
      Math.round(client.ws.ping);

    const uptimeSeconds =
      Math.floor(process.uptime());

    const days =
      Math.floor(
        uptimeSeconds / 86400
      );

    const hours =
      Math.floor(
        (uptimeSeconds % 86400) / 3600
      );

    const minutes =
      Math.floor(
        (uptimeSeconds % 3600) / 60
      );

    const seconds =
      uptimeSeconds % 60;

    const uptimeParts = [];

    if (days) {
      uptimeParts.push(`${days}d`);
    }

    if (hours) {
      uptimeParts.push(`${hours}h`);
    }

    if (minutes) {
      uptimeParts.push(`${minutes}m`);
    }

    if (
      seconds ||
      uptimeParts.length === 0
    ) {
      uptimeParts.push(`${seconds}s`);
    }

    const uptime =
      uptimeParts.join(" ");

    const memory =
      (
        process.memoryUsage()
          .heapUsed /
        1024 /
        1024
      ).toFixed(2);

    const embed =
      new EmbedBuilder()
        .setTitle(
          "🏓 Yunki Bot — Pong!"
        )
        .setDescription(
          "Hệ thống đang hoạt động bình thường."
        )
        .addFields(
          {
            name: "🤖 Bot Latency",
            value: `\`${botLatency} ms\``,
            inline: true
          },
          {
            name: "📡 API Ping",
            value: `\`${apiPing} ms\``,
            inline: true
          },
          {
            name: "⏱️ Uptime",
            value: `\`${uptime}\``,
            inline: true
          },
          {
            name: "💾 Memory",
            value: `\`${memory} MB\``,
            inline: true
          },
          {
            name: "🌐 Servers",
            value: `\`${client.guilds.cache.size}\``,
            inline: true
          },
          {
            name: "📦 Commands",
            value: `\`${client.commands.size}\``,
            inline: true
          }
        )
        .setColor("#57F287")
        .setFooter({
          text:
            "Yunki Bot • Giáo Phái Phoebe"
        })
        .setTimestamp();

    await interaction.reply({
      embeds: [embed]
    });
  }
};