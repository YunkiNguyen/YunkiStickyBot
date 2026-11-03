import {
  SlashCommandBuilder,
  PermissionFlagsBits, MessageFlags
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDescription("Gỡ ban một User ID.")
    .addStringOption(option =>
      option
        .setName("user")
        .setDescription("User ID của người cần unban.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setMaxLength(400)
        .setDescription("Lý do unban.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Ban Members**.",
        flags: MessageFlags.Ephemeral
      });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: "❌ Yunki Bot không có quyền **Ban Members**.",
        flags: MessageFlags.Ephemeral
      });
    }

    const userId =
      interaction.options.getString("user");

    const reason =
      interaction.options.getString("reason") ||
      "Không có lý do.";

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({
        content: "❌ User ID không hợp lệ.",
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await interaction.guild.members.unban(
        userId,
        `${reason} | By ${interaction.user.tag}`
      );

      return interaction.reply({
        content:
          `🔓 Đã unban User ID \`${userId}\`.\n` +
          `> Lý do: ${reason}`
      });
    } catch (error) {
      console.error("[UNBAN ERROR]", error);

      return interaction.reply({
        content:
          "❌ Không tìm thấy user trong danh sách ban hoặc không thể unban.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
};