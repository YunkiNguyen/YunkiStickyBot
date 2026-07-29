import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Gỡ timeout cho một thành viên.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Thành viên cần gỡ timeout.")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Moderate Members**.",
        ephemeral: true
      });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: "❌ Yunki Bot không có quyền **Moderate Members**.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("user");

    const target = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!target) {
      return interaction.reply({
        content: "❌ Không tìm thấy thành viên.",
        ephemeral: true
      });
    }

    if (
      target.roles.highest.position >= botMember.roles.highest.position
    ) {
      return interaction.reply({
        content: "❌ Bot không thể quản lý thành viên có role cao hơn hoặc bằng bot.",
        ephemeral: true
      });
    }

    try {
      await target.timeout(
        null,
        `Removed by ${interaction.user.tag}`
      );

      return interaction.reply({
        content: `🔓 Đã gỡ timeout cho **${target.user.tag}**.`
      });
    } catch (error) {
      console.error("[UNTIMEOUT ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể gỡ timeout cho thành viên này.",
        ephemeral: true
      });
    }
  }
};