import {
  SlashCommandBuilder,
  PermissionFlagsBits, MessageFlags
} from "discord.js";

import { addWarning } from "../../utils/warningsStore.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
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
        .setMaxLength(200)
        .setDescription("Lý do cảnh cáo.")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Moderate Members**.",
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Bạn không thể cảnh cáo chính mình.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ Bot không thể tự cảnh cáo.",
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

    try {
      const warnings = addWarning(
        interaction.guild.id,
        target.id,
        {
          reason,
          moderator: interaction.user.id,
          timestamp: Date.now()
        }
      );

      return interaction.reply({
        content:
          `⚠️ Đã cảnh cáo **${target.user.tag}**.\n` +
          `> Lý do: ${reason}\n` +
          `> Tổng cảnh cáo: **${warnings.length}**`
      });
    } catch (error) {
      console.error("[WARN ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể lưu cảnh cáo cho thành viên này.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
