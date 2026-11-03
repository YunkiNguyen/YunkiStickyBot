import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Xóa tin nhắn trong kênh.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
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
        flags: MessageFlags.Ephemeral
      });
    }

    const channel = interaction.channel;
    const botMember = interaction.guild.members.me;
    const botPermissions = botMember ? channel?.permissionsFor(botMember) : null;

    // Kiểm tra quyền Ở CẤP KÊNH (channel override có thể chặn dù server cho phép).
    if (
      !channel?.bulkDelete ||
      !botPermissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory
      ])
    ) {
      return interaction.reply({
        content:
          "❌ Yunki Bot cần quyền **View Channel, Manage Messages, Read Message History** ở kênh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    const amount = interaction.options.getInteger("amount");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const deleted = await channel.bulkDelete(amount, true);

      return interaction.editReply({
        content: `🧹 Đã xóa **${deleted.size}** tin nhắn (tin nhắn quá 14 ngày không xóa được hàng loạt).`
      });
    } catch (error) {
      console.error("[CLEAR ERROR]", error);

      return interaction.editReply({
        content: "❌ Không thể xóa tin nhắn."
      });
    }
  }
};
