import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Xem cấu hình và trạng thái của Yunki Bot."),

  async execute(interaction) {
    const client = interaction.client;

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Yunki Bot Configuration")
      .setDescription(
        "Thông tin cấu hình và trạng thái hiện tại của Yunki Bot."
      )
      .addFields(
        {
          name: "🤖 Bot",
          value: client.user
            ? `${client.user}`
            : "Offline",
          inline: true
        },
        {
          name: "📡 Ping",
          value: `${Math.max(0, Math.round(client.ws.ping))} ms`,
          inline: true
        },
        {
          name: "🏠 Servers",
          value: `${client.guilds.cache.size}`,
          inline: true
        },
        {
          name: "📚 Commands",
          value: `${client.commands?.size ?? 0}`,
          inline: true
        },
        {
          name: "📌 Sticky",
          value: "Hệ thống Sticky đang hoạt động.",
          inline: true
        },
        {
          name: "⚠️ Warnings",
          value: "Hệ thống cảnh cáo đang hoạt động.",
          inline: true
        }
      )
      .setColor("#5865F2")
      .setFooter({
        text: "Yunki Bot • Giáo Phái Phoebe"
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};