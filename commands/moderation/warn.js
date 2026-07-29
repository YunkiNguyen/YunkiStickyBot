import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Cảnh cáo một thành viên.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Thành viên cần cảnh cáo.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Lý do cảnh cáo.")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Moderate Members**.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

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
        content: "❌ Bạn không thể cảnh cáo chính mình.",
        ephemeral: true
      });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ Bot không thể tự cảnh cáo.",
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

    try {
      // Warn data được xử lý bởi hệ thống database hiện tại.
      // File này sẽ dùng interaction.client.warnings nếu index.js đã khởi tạo.
      if (!interaction.client.warnings) {
        interaction.client.warnings = new Map();
      }

      const guildWarnings =
        interaction.client.warnings.get(interaction.guild.id) ||
        new Map();

      const userWarnings =
        guildWarnings.get(target.id) || [];

      userWarnings.push({
        reason,
        moderator: interaction.user.id,
        timestamp: Date.now()
      });

      guildWarnings.set(target.id, userWarnings);
      interaction.client.warnings.set(
        interaction.guild.id,
        guildWarnings
      );

      return interaction.reply({
        content:
          `⚠️ Đã cảnh cáo **${target.user.tag}**.\n` +
          `> Lý do: ${reason}\n` +
          `> Tổng cảnh cáo: **${userWarnings.length}**`
      });
    } catch (error) {
      console.error("[WARN ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể cảnh cáo thành viên này.",
        ephemeral: true
      });
    }
  }
};