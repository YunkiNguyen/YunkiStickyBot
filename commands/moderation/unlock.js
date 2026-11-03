import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from "discord.js";
import { getLockState, removeLockState } from "../../utils/lockStore.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Mở khóa kênh hiện tại.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Manage Channels**.",
        flags: MessageFlags.Ephemeral
      });
    }

    const channel = interaction.channel;

    if (!channel?.permissionOverwrites) {
      return interaction.reply({
        content: "❌ Không thể mở khóa loại kênh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    const botMember = interaction.guild.members.me;
    const botPermissions = botMember ? channel.permissionsFor(botMember) : null;

    if (
      !botPermissions?.has([
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles
      ])
    ) {
      return interaction.reply({
        content:
          "❌ Yunki Bot cần quyền **Manage Channels** và **Manage Roles** (Manage Permissions) ở kênh này.",
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const saved = getLockState(channel.id);
      // true / false / null = trạng thái @everyone trước khi /lock.
      // Không có bản ghi (kênh bị khóa thủ công) -> về mặc định (null).
      const restoreTo = saved === undefined ? null : saved;

      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: restoreTo }
      );

      removeLockState(channel.id);

      return interaction.reply({
        content:
          restoreTo === false
            ? "🔓 Đã khôi phục trạng thái trước khi khóa (kênh này vốn chỉ-đọc nên vẫn không cho @everyone gửi tin)."
            : "🔓 Đã mở khóa kênh này."
      });
    } catch (error) {
      console.error("[UNLOCK ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể mở khóa kênh.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
