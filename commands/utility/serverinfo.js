import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("Xem thông tin server."),
  async execute(interaction) {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner();

    const embed = new EmbedBuilder()
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 512 }))
      .addFields(
        { name: "🆔 Server ID", value: `\`${guild.id}\``, inline: true },
        { name: "👑 Owner", value: `${owner.user}`, inline: true },
        { name: "👥 Members", value: `${guild.memberCount}`, inline: true },
        { name: "💬 Channels", value: `${guild.channels.cache.size}`, inline: true },
        { name: "🎭 Roles", value: `${guild.roles.cache.size}`, inline: true },
        { name: "😀 Emojis", value: `${guild.emojis.cache.size}`, inline: true },
        { name: "📅 Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>` }
      )
      .setColor("#5865F2").setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
