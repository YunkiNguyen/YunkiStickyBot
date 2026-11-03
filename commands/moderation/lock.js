import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from "discord.js";
import { getLockState, setLockState } from "../../utils/lockStore.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Khóa kênh hiện tại.")
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
        content: "❌ Không thể khóa loại kênh này.",
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
      const everyone = interaction.guild.roles.everyone;
      const overwrite = channel.permissionOverwrites.cache.get(everyone.id);

      const alreadyLocked =
        overwrite?.deny.has(PermissionFlagsBits.SendMessages) &&
        getLockState(channel.id) !== undefined;

      // Nhớ trạng thái cũ của @everyone để /unlock khôi phục đúng
      // (ví dụ kênh vốn chỉ-đọc sẽ vẫn chỉ-đọc sau khi unlock).
      if (!alreadyLocked) {
        let previous = null;

        if (overwrite?.allow.has(PermissionFlagsBits.SendMessages)) {
          previous = true;
        } else if (overwrite?.deny.has(PermissionFlagsBits.SendMessages)) {
          previous = false;
        }

        setLockState(channel.id, previous);
      }

      await channel.permissionOverwrites.edit(everyone, {
        SendMessages: false
      });

      return interaction.reply({
        content: "🔒 Đã khóa kênh này."
      });
    } catch (error) {
      console.error("[LOCK ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể khóa kênh.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
