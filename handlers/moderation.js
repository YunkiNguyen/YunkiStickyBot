import { PermissionFlagsBits } from "discord.js";

export async function getTargetMember(interaction) {
  const user = interaction.options.getUser("user");
  if (!user) return null;

  return interaction.guild.members.fetch(user.id).catch(() => null);
}

export function canModerateTarget(interaction, target) {
  if (!target) return { ok: false, message: "❌ Không tìm thấy thành viên." };

  if (target.id === interaction.user.id) {
    return { ok: false, message: "❌ Bạn không thể sử dụng lệnh này lên chính mình." };
  }

  if (target.id === interaction.client.user.id) {
    return { ok: false, message: "❌ Tôi không thể thực hiện lệnh này lên chính mình." };
  }

  const executor = interaction.member;
  if (
    executor &&
    target.roles.highest.position >= executor.roles.highest.position &&
    interaction.guild.ownerId !== interaction.user.id
  ) {
    return {
      ok: false,
      message: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bạn."
    };
  }

  const botMember = interaction.guild.members.me;
  if (
    botMember &&
    target.roles.highest.position >= botMember.roles.highest.position
  ) {
    return {
      ok: false,
      message: "❌ Role của thành viên này cao hơn hoặc bằng role cao nhất của bot."
    };
  }

  return { ok: true };
}

export function requirePermission(interaction, permission, label) {
  if (!interaction.memberPermissions?.has(permission)) {
    return {
      ok: false,
      message: `❌ Bạn không có quyền **${label}**.`
    };
  }

  const bot = interaction.guild.members.me;
  if (bot && !bot.permissions.has(permission)) {
    return {
      ok: false,
      message: `❌ Bot không có quyền **${label}**.`
    };
  }

  return { ok: true };
}

export function memberName(member) {
  return member?.displayName || member?.user?.username || "Unknown User";
}

export { PermissionFlagsBits };
