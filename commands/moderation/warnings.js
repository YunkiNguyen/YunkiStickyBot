import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags
} from "discord.js";

import { getUserWarnings } from "../../utils/warningsStore.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDescription("Xem danh sách cảnh cáo.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Thành viên cần xem cảnh cáo.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Moderate Members**.",
        flags: MessageFlags.Ephemeral
      });
    }

    const user =
      interaction.options.getUser("user") ||
      interaction.user;

    const warnings = getUserWarnings(
      interaction.guild.id,
      user.id
    );

    if (!warnings.length) {
      return interaction.reply({
        content: `📋 **${user.username}** hiện không có cảnh cáo.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const shown = warnings.slice(-10);
    const offset = warnings.length - shown.length;

    const list = shown
      .map((warning, index) => {
        const reason = String(warning.reason ?? "").slice(0, 200);

        return (
          `**${offset + index + 1}.** ${reason}\n` +
          `> Moderator: <@${warning.moderator}> • ` +
          `<t:${Math.floor(warning.timestamp / 1000)}:R>`
        );
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Warnings — ${user.username}`)
      .setThumbnail(
        user.displayAvatarURL({ size: 256 })
      )
      .setDescription(list)
      .setColor("#FEE75C")
      .setFooter({
        text: `Tổng: ${warnings.length}`
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral
    });
  }
};
