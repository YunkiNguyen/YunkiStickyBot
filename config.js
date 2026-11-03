const config = {
  // Có thể đặt CLIENT_ID trong Secrets; mặc định dùng ID bot hiện tại.
  botId: process.env.CLIENT_ID || "1432015818451062804",

  // GUILD_ID là TUỲ CHỌN và chỉ nên dùng khi test trên 1 server.
  // Để trống => deploy Global Commands (dùng được ở mọi server bot tham gia).
  guildId: process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || "",

  botName: "Yunki Bot",
  // Tên ngắn in trên embed. serverName là tên đầy đủ của server.
  brand: "Giáo Phái Phoebe",
  serverName: "Giáo Phái Fibi Chuppi [Phoebe & her citizens]"
};

export function brandFooter() {
  return `${config.botName} • ${config.brand}`;
}

export default config;
