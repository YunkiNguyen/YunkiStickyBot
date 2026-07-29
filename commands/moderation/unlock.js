import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Mở khóa kênh hiện tại."),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Manage Channels**.",
        ephemeral: true
      });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "❌ Yunki Bot không có quyền **Manage Channels**.",
        ephemeral: true
      });
    }

    try {
      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: null
        }
      );

      return interaction.reply({
        content: "🔓 Đã mở khóa kênh này."
      });
    } catch (error) {
      console.error("[UNLOCK ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể mở khóa kênh.",
        ephemeral: true
      });
    }
  }
};