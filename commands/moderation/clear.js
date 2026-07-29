import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Xóa tin nhắn trong kênh.")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Số lượng tin nhắn cần xóa.")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Manage Messages**.",
        ephemeral: true
      });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: "❌ Yunki Bot không có quyền **Manage Messages**.",
        ephemeral: true
      });
    }

    const amount = interaction.options.getInteger("amount");

    try {
      const deleted =
        await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({
        content: `🧹 Đã xóa **${deleted.size}** tin nhắn.`,
        ephemeral: true
      });
    } catch (error) {
      console.error("[CLEAR ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể xóa tin nhắn.",
        ephemeral: true
      });
    }
  }
};