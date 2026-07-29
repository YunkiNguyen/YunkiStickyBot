import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Khóa kênh hiện tại."),

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
          SendMessages: false
        }
      );

      return interaction.reply({
        content: "🔒 Đã khóa kênh này."
      });
    } catch (error) {
      console.error("[LOCK ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể khóa kênh.",
        ephemeral: true
      });
    }
  }
};