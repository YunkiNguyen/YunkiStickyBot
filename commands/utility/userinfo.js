import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("userinfo").setDescription("Xem thông tin thành viên.")
    .addUserOption(o => o.setName("user").setDescription("Thành viên").setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const roles = member?.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString())
      .slice(0, 15)
      .join(", ") || "Không có";

    const embed = new EmbedBuilder()
      .setTitle("👤 Thông tin người dùng")
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: "👤 Người dùng", value: `${user}`, inline: true },
        { name: "🆔 User ID", value: `\`${user.id}\``, inline: true },
        { name: "📅 Tạo tài khoản", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>` },
        { name: "📥 Tham gia Server", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Không xác định" },
        { name: "🎭 Roles", value: roles }
      )
      .setColor("#5865F2").setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
