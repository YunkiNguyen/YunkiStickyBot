import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warnings")
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
        ephemeral: true
      });
    }

    const user =
      interaction.options.getUser("user") ||
      interaction.user;

    const guildWarnings =
      interaction.client.warnings?.get(interaction.guild.id);

    const warnings =
      guildWarnings?.get(user.id) || [];

    if (!warnings.length) {
      return interaction.reply({
        content: `📋 **${user.username}** hiện không có cảnh cáo.`,
        ephemeral: true
      });
    }

    const list = warnings
      .slice(-10)
      .map((warning, index) => {
        return (
          `**${index + 1}.** ${warning.reason}\n` +
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
      ephemeral: true
    });
  }
};