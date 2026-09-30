import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits
} from "discord.js";
import {
  joinVoiceChannel,
  getVoiceConnection
} from "@discordjs/voice";
import { setVoiceChannel } from "../../utils/voiceStore.js";
import { attachVoiceConnectionHandlers } from "../../utils/voiceConnection.js";

export default {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Bot vào kênh voice và treo ở đó.")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Kênh voice muốn bot vào (để trống = kênh bạn đang ở)")
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

  async execute(interaction, client) {
    const member = interaction.member;
    let channel = interaction.options.getChannel("channel");

    if (!channel) {
      channel = member.voice?.channel;
    }

    if (!channel) {
      return interaction.reply({
        content: "❌ Bạn phải ở trong voice hoặc chỉ định kênh voice!",
        ephemeral: true
      });
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(["Connect", "ViewChannel"])) {
      return interaction.reply({
        content: "❌ Bot không có quyền **Connect** vào kênh này!",
        ephemeral: true
      });
    }

    const existing = getVoiceConnection(interaction.guildId);
    if (existing) {
      try {
        existing.destroy();
      } catch {}
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    attachVoiceConnectionHandlers(connection, interaction.guildId, client);

    // Lưu lại để bot tự join khi restart / bị kick / mất kết nối
    setVoiceChannel(interaction.guildId, channel.id);

    await interaction.reply(
      `✅ Đã vào **${channel.name}** và sẽ treo ở đây cho đến khi dùng \`/leave\`.\nBot sẽ tự join lại rất nhanh nếu bị out hoặc restart.`
    );
  }
};
