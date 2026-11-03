import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { removeVoiceChannel } from "../../utils/voiceStore.js";
import {
  cancelRejoin,
  destroyConnectionQuietly
} from "../../utils/voiceConnection.js";

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Kick bot ra khỏi kênh voice.")
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

  async execute(interaction) {
    // Xoá dữ liệu + huỷ lịch rejoin TRƯỚC khi destroy để không bị auto-rejoin.
    cancelRejoin(interaction.guildId);
    removeVoiceChannel(interaction.guildId);

    const connection = getVoiceConnection(interaction.guildId);

    if (!connection) {
      return interaction.reply({
        content: "❌ Bot hiện không ở trong kênh voice nào cả.",
        flags: MessageFlags.Ephemeral
      });
    }

    destroyConnectionQuietly(connection);

    await interaction.reply("✅ Đã kick bot ra khỏi voice. Sẽ không tự join lại nữa.");
  }
};
