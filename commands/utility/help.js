import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";

export default {
  data: new SlashCommandBuilder().setName("help").setDescription("Xem danh sách lệnh Yunki Bot."),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("📚 Yunki Bot — Trợ giúp")
      .setDescription("Danh sách lệnh của **Yunki Bot**.")
      .addFields(
        {
          name: "🛡️ Moderation",
          value: "`/ban` `/unban` `/kick` `/timeout` `/untimeout`\n`/warn` `/warnings` `/clear` `/lock` `/unlock` `/slowmode`"
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
          value: "`/ping` `/status` `/config` `/userinfo` `/serverinfo` `/help`"
        }
      )
      .setColor("#5865F2")
      .setFooter({ text: "Yunki Bot • Giáo Phái Phoebe" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
