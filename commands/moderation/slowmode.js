import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Thiết lập slowmode cho kênh.")
    .addIntegerOption(option =>
      option
        .setName("seconds")
        .setDescription("Thời gian slowmode, từ 0 đến 21600 giây.")
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Manage Channels**.",
        ephemeral: true
      });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "❌ Yunki Bot không có quyền **Manage Channels**.",
        ephemeral: true
      });
    }

    const seconds =
      interaction.options.getInteger("seconds");

    try {
      await interaction.channel.setRateLimitPerUser(seconds);

      return interaction.reply({
        content:
          seconds === 0
            ? "🐢 Slowmode đã được tắt."
            : `🐢 Slowmode đã được đặt thành **${seconds} giây**.`
      });
    } catch (error) {
      console.error("[SLOWMODE ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể thay đổi slowmode.",
        ephemeral: true
      });
    }
  }
};