const config = {
  // Có thể đặt CLIENT_ID trong Secrets; mặc định dùng ID bot hiện tại.
  botId: process.env.CLIENT_ID || "1432015818451062804",

  // GUILD_ID là TUỲ CHỌN và chỉ nên dùng khi test trên 1 server.
  // Để trống => deploy Global Commands (dùng được ở mọi server bot tham gia).
  guildId: process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || "",

  defaultChannelId: "",

  botName: "Yunki Bot",
  serverName: "Giáo Phái Fibi Chuppi [Phoebe & her citizens]"
};

export default config;
