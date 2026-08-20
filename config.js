const config = {
  botId: "1432015818451062804",

  // Có thể đặt GUILD_ID trong Replit Secrets để deploy slash commands
  // trực tiếp vào server và cập nhật gần như ngay lập tức.
  guildId: process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || "",

  defaultChannelId: "",

  botName: "Yunki Bot",
  serverName: "Giáo Phái Fibi Chuppi [Phoebe & her citizens]"
};

export default config;
