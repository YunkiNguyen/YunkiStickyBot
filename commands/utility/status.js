import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

function duration(seconds) {
  seconds = Math.floor(seconds);
  const d = Math.floor(seconds / 86400); seconds %= 86400;
  const h = Math.floor(seconds / 3600); seconds %= 3600;
  const m = Math.floor(seconds / 60); seconds %= 60;
  const s = seconds % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(" ");
}

export default {
  data: new SlashCommandBuilder().setName("status").setDescription("Xem trạng thái hệ thống."),
  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setTitle("📊 Trạng thái hệ thống")
      .addFields(
        { name: "📡 Ping", value: `${Math.round(client.ws.ping)} ms`, inline: true },
        { name: "🕐 Uptime", value: duration(process.uptime()), inline: true },
        { name: "💾 RAM", value: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: "🏠 Servers", value: `${client.guilds.cache.size}`, inline: true }
      )
      .setColor("#4B79F6").setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
