import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from "discord.js";

import { getUserWarnings, removeWarnings } from "../../utils/warningsStore.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unwarn")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDescription("Gỡ cảnh cáo của một thành viên.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Thành viên cần gỡ cảnh cáo.")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("count")
        .setDescription("Số cảnh cáo mới nhất cần gỡ. Mặc định 1.")
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName("all")
        .setDescription("Gỡ toàn bộ cảnh cáo của thành viên này.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Moderate Members**.",
        flags: MessageFlags.Ephemeral
      });
    }

    const user = interaction.options.getUser("user");
    const clearAll = interaction.options.getBoolean("all") === true;
    const count = interaction.options.getInteger("count") ?? 1;

    if (user.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ Không áp dụng cho bot.",
        flags: MessageFlags.Ephemeral
      });
    }

    const target = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (
      target &&
      interaction.guild.ownerId !== interaction.user.id &&
      target.roles.highest.position >= interaction.member.roles.highest.position
    ) {
      return interaction.reply({
        content: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bạn.",
        flags: MessageFlags.Ephemeral
      });
    }

    const before = getUserWarnings(interaction.guild.id, user.id);
    if (before.length === 0) {
      return interaction.reply({
        content: `📋 **${user.tag}** không có cảnh cáo để gỡ.`,
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const result = removeWarnings(
        interaction.guild.id,
        user.id,
        clearAll ? Infinity : count
      );

      const reasons = result.removed
        .slice()
        .reverse()
        .map(warning => String(warning.reason ?? "").slice(0, 120))
        .join("; ");

      return interaction.reply({
        content:
          `✅ Đã gỡ **${result.removed.length}** cảnh cáo của **${user.tag}**.\n` +
          `> Còn lại: **${result.remaining.length}**\n` +
          (reasons ? `> Đã gỡ: ${reasons}` : "")
      });
    } catch (error) {
      console.error("[UNWARN ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể gỡ cảnh cáo.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
