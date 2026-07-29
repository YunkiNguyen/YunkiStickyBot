import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban một thành viên khỏi server.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Thành viên cần ban.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Lý do ban.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Ban Members**.",
        ephemeral: true
      });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: "❌ Yunki Bot không có quyền **Ban Members**.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("user");
    const reason =
      interaction.options.getString("reason") ||
      "Không có lý do.";

    const target = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!target) {
      return interaction.reply({
        content: "❌ Không tìm thấy thành viên trong server.",
        ephemeral: true
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Bạn không thể ban chính mình.",
        ephemeral: true
      });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ Bot không thể ban chính mình.",
        ephemeral: true
      });
    }

    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({
        content: "❌ Không thể ban Server Owner.",
        ephemeral: true
      });
    }

    if (
      interaction.guild.ownerId !== interaction.user.id &&
      target.roles.highest.position >= interaction.member.roles.highest.position
    ) {
      return interaction.reply({
        content: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bạn.",
        ephemeral: true
      });
    }

    if (target.roles.highest.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bot.",
        ephemeral: true
      });
    }

    try {
      await target.ban({
        reason: `${reason} | By ${interaction.user.tag}`
      });

      return interaction.reply({
        content:
          `🔨 Đã ban **${target.user.tag}**.\n` +
          `> Lý do: ${reason}`
      });
    } catch (error) {
      console.error("[BAN ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể ban thành viên này.",
        ephemeral: true
      });
    }
  }
};