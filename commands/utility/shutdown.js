import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("shutdown")
    .setDescription("Tắt Yunki Bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    // Chỉ Owner được phép shutdown
    const ownerId = process.env.BOT_OWNER_ID;

    if (!ownerId) {
      console.error("BOT_OWNER_ID chưa được cấu hình.");
      return interaction.reply({
        content: "❌ Bot chưa được cấu hình Owner ID.",
        ephemeral: true
      });
    }

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "❌ Chỉ Bot Owner mới có thể sử dụng lệnh này.",
        ephemeral: true
      });
    }

    await interaction.reply({
      content: "🛑 Yunki Bot đang tắt...",
      ephemeral: true
    });

    console.log(
      `🛑 SHUTDOWN requested by ${interaction.user.tag} (${interaction.user.id})`
    );

    // Cho Discord xử lý response trước khi đóng connection
    setTimeout(async () => {
      try {
        console.log("🔌 Đang đóng Discord connection...");
        await client.destroy();

        console.log("✅ Yunki Bot đã tắt.");
        process.exit(0);
      } catch (error) {
        console.error("❌ Lỗi khi shutdown:", error);
        process.exit(1);
      }
    }, 1000);
  }
};