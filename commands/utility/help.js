import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { brandFooter } from "../../config.js";

export default {
  data: new SlashCommandBuilder().setName("help").setDescription("Xem danh sách lệnh Yunki Bot."),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("📚 Yunki Bot — Trợ giúp")
      .setDescription("Danh sách lệnh của **Yunki Bot**.")
      .addFields(
        {
          name: "🛡️ Moderation",
          value: "`/ban` `/unban` `/kick` `/timeout` `/untimeout`\n`/warn` `/unwarn` `/warnings` `/clear` `/lock` `/unlock` `/slowmode`"
        },
        {
          name: "🎉 Giveaway",
          value: "`/giveaway start` `/giveaway end` `/giveaway reroll` `/giveaway list` `/giveaway recover`"
        },
        {
          name: "🔊 Voice",
          value: "`/join` `/leave`"
        },
        {
          name: "🔧 Tiện ích",
          value: "`/ping` `/status` `/config` `/userinfo` `/serverinfo` `/help`\n`/shutdown` (chỉ owner)"
        }
      )
      .setColor("#5865F2")
      .setFooter({ text: brandFooter() })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
