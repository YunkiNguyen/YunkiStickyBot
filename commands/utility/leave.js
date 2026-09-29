import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Kick bot ra khỏi kênh voice.")
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

  async execute(interaction) {
    const connection = getVoiceConnection(interaction.guildId);

    if (!connection) {
      return interaction.reply({
        content: "❌ Bot hiện không ở trong kênh voice nào cả.",
        ephemeral: true
      });
    }

    connection.destroy();
    await interaction.reply("✅ Đã kick bot ra khỏi voice.");
  }
};
