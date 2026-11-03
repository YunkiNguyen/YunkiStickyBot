import {
  SlashCommandBuilder,
  PermissionFlagsBits, MessageFlags
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDescription("Kick một thành viên khỏi server.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Thành viên cần kick.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setMaxLength(400)
        .setDescription("Lý do kick.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Kick Members**.",
        flags: MessageFlags.Ephemeral
      });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({
        content: "❌ Yunki Bot không có quyền **Kick Members**.",
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Bạn không thể kick chính mình.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ Bot không thể kick chính mình.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({
        content: "❌ Không thể kick Server Owner.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (
      interaction.guild.ownerId !== interaction.user.id &&
      target.roles.highest.position >= interaction.member.roles.highest.position
    ) {
      return interaction.reply({
        content: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bạn.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (target.roles.highest.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bot.",
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await target.kick(
        `${reason} | By ${interaction.user.tag}`
      );

      return interaction.reply({
        content:
          `👢 Đã kick **${target.user.tag}**.\n` +
          `> Lý do: ${reason}`
      });
    } catch (error) {
      console.error("[KICK ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể kick thành viên này.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
};