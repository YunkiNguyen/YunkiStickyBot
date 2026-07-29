import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout một thành viên.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Thành viên cần timeout.")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("duration")
        .setDescription("Thời gian timeout tính bằng phút.")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Lý do timeout.")
        .setRequired(false)
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
    const duration = interaction.options.getInteger("duration");
    const reason =
      interaction.options.getString("reason") ||
      "Không có lý do.";

    const target = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!target) {
      return interaction.reply({
        content: "❌ Không tìm thấy thành viên.",
        ephemeral: true
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Bạn không thể timeout chính mình.",
        ephemeral: true
      });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ Bot không thể timeout chính mình.",
        ephemeral: true
      });
    }

    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({
        content: "❌ Không thể timeout Server Owner.",
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
      await target.timeout(
        duration * 60 * 1000,
        `${reason} | By ${interaction.user.tag}`
      );

      return interaction.reply({
        content:
          `⏱️ Đã timeout **${target.user.tag}** trong **${duration} phút**.\n` +
          `> Lý do: ${reason}`
      });
    } catch (error) {
      console.error("[TIMEOUT ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể timeout thành viên này.",
        ephemeral: true
      });
    }
  }
};