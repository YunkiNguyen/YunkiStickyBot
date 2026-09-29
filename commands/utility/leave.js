import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { removeVoiceChannel } from "../../utils/voiceStore.js";

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Kick bot ra khỏi kênh voice.")
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

  async execute(interaction) {
    const connection = getVoiceConnection(interaction.guildId);

    if (!connection) {
      // Vẫn xóa dữ liệu đã lưu phòng trường hợp bot offline trước đó
      removeVoiceChannel(interaction.guildId);

      return interaction.reply({
        content: "❌ Bot hiện không ở trong kênh voice nào cả.",
        ephemeral: true
      });
    }

    connection.destroy();
    removeVoiceChannel(interaction.guildId);

    await interaction.reply("✅ Đã kick bot ra khỏi voice. Sẽ không tự join lại nữa.");
  }
};
