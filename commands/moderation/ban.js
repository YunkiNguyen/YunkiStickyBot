import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDescription("Ban một thành viên khỏi server (kể cả người đã rời server).")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Thành viên cần ban.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setMaxLength(400)
        .setDescription("Lý do ban.")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: "❌ Bạn không có quyền **Ban Members**.",
        flags: MessageFlags.Ephemeral
      });
    }

    const botMember = interaction.guild.members.me;

    if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: "❌ Yunki Bot không có quyền **Ban Members**.",
        flags: MessageFlags.Ephemeral
      });
    }

    const user = interaction.options.getUser("user");
    const reason =
      interaction.options.getString("reason") ||
      "Không có lý do.";

    if (user.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Bạn không thể ban chính mình.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (user.id === interaction.client.user.id) {
      return interaction.reply({
        content: "❌ Bot không thể ban chính mình.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (user.id === interaction.guild.ownerId) {
      return interaction.reply({
        content: "❌ Không thể ban Server Owner.",
        flags: MessageFlags.Ephemeral
      });
    }

    const target = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    // Người đã rời server: vẫn ban được theo ID, không cần kiểm tra role.
    if (target) {
      if (
        interaction.guild.ownerId !== interaction.user.id &&
        target.roles.highest.position >= interaction.member.roles.highest.position
      ) {
        return interaction.reply({
          content: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bạn.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (target.roles.highest.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bot.",
          flags: MessageFlags.Ephemeral
        });
      }
    }

    try {
      await interaction.guild.members.ban(user.id, {
        reason: `${reason} | By ${interaction.user.tag}`
      });

      return interaction.reply({
        content:
          `🔨 Đã ban **${user.tag}**${target ? "" : " (không còn trong server)"}.\n` +
          `> Lý do: ${reason}`
      });
    } catch (error) {
      console.error("[BAN ERROR]", error);

      return interaction.reply({
        content: "❌ Không thể ban thành viên này.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
