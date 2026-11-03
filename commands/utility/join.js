import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags
} from "discord.js";
import { setVoiceChannel } from "../../utils/voiceStore.js";
import { joinSavedVoiceChannel } from "../../utils/voiceConnection.js";

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
    let channel = interaction.options.getChannel("channel");

    if (!channel) {
      channel = interaction.member?.voice?.channel;
    }

    if (!channel) {
      return interaction.reply({
        content: "❌ Bạn phải ở trong voice hoặc chỉ định kênh voice!",
        flags: MessageFlags.Ephemeral
      });
    }

    const me = interaction.guild.members.me;
    const permissions = me ? channel.permissionsFor(me) : null;

    if (
      !permissions?.has([
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.ViewChannel
      ])
    ) {
      return interaction.reply({
        content: "❌ Bot không có quyền **Connect** vào kênh này!",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    // Lưu trước: các listener rejoin luôn đọc kênh mới nhất.
    setVoiceChannel(interaction.guildId, channel.id);

    const ok = await joinSavedVoiceChannel(
      client,
      interaction.guildId,
      channel.id,
      "MANUAL"
    );

    if (!ok) {
      return interaction.editReply(
        `⚠️ Chưa vào được **${channel.name}** ngay (có thể do quyền, kênh đầy hoặc Discord chậm). Bot sẽ tự thử lại; xem log nếu vẫn không được.`
      );
    }

    return interaction.editReply(
      `✅ Đã vào **${channel.name}** và sẽ treo ở đây cho đến khi dùng \`/leave\`.\nBot sẽ tự join lại nếu bị out hoặc restart.`
    );
  }
};
