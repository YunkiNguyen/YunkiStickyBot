import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} from "discord.js";

import {
  getGiveaway,
  setGiveaway,
  loadGiveaways,
  isValidMessageId
} from "../../utils/giveawayStore.js";

import {
  endGiveaway,
  rerollGiveaway,
  scheduleGiveaway,
  fetchReactionUserIds
} from "../../utils/giveawayService.js";

const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_DURATION_MS = 10_000;

const processedInteractions = new Set();
const MAX_INTERACTION_CACHE = 5000;

function markInteraction(id) {
  if (processedInteractions.has(id)) return false;

  processedInteractions.add(id);

  if (processedInteractions.size > MAX_INTERACTION_CACHE) {
    const first = processedInteractions.values().next().value;
    if (first) processedInteractions.delete(first);
  }

  return true;
}

const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

// Hỗ trợ "90s", "10m", "1h", "7d" và dạng ghép như "1h30m".
function parseDuration(value) {
  if (!value) return null;

  const text = value.trim().toLowerCase();
  if (!/^(\d+[smhd])+$/.test(text)) return null;

  let total = 0;
  for (const match of text.matchAll(/(\d+)([smhd])/g)) {
    total += Number(match[1]) * UNIT_MS[match[2]];
  }

  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

function belongsToGuild(giveaway, guildId) {
  return !giveaway.guildId || giveaway.guildId === guildId;
}

export default {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Hệ thống Giveaway của Yunki Bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Tạo Giveaway mới")
        .addStringOption(option =>
          option
            .setName("prize")
            .setDescription("Phần thưởng Giveaway")
            .setMaxLength(200)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("duration")
            .setDescription("Ví dụ: 10m, 1h, 7d, 1h30m (tối đa 365d)")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription("Số người thắng")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Kênh đăng Giveaway")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement
            )
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("end")
        .setDescription("Kết thúc Giveaway")
        .addStringOption(option =>
          option
            .setName("message_id")
            .setDescription("ID message Giveaway")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("reroll")
        .setDescription("Chọn lại người thắng (loại người đã thắng)")
        .addStringOption(option =>
          option
            .setName("message_id")
            .setDescription("ID message Giveaway")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription("Số người thắng mới (mặc định 1)")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("Xem Giveaway đang chạy trong server này")
    )

    .addSubcommand(sub =>
      sub
        .setName("recover")
        .setDescription("Khôi phục Giveaway bị mất dữ liệu (chạy trong kênh có giveaway)")
        .addStringOption(option =>
          option
            .setName("message_id")
            .setDescription("ID message Giveaway")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("prize")
            .setDescription("Phần thưởng, để trống sẽ lấy từ embed")
            .setMaxLength(200)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription("Số người thắng, để trống sẽ lấy từ embed")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addStringOption(option =>
          option
            .setName("duration")
            .setDescription("Thời gian còn lại (vd 11d, 5h). Để trống = đọc giờ kết thúc từ embed")
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    if (!markInteraction(interaction.id)) {
      console.warn(`DUPLICATE GIVEAWAY INTERACTION: ${interaction.id}`);
      return;
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error("DEFER GIVEAWAY ERROR:", error);
      return;
    }

    try {
      const sub = interaction.options.getSubcommand();

      // ------------------------------------------------------------ START
      if (sub === "start") {
        const prize = interaction.options.getString("prize");
        const durationString = interaction.options.getString("duration");
        const winnersCount = interaction.options.getInteger("winners");
        const channel =
          interaction.options.getChannel("channel") || interaction.channel;

        if (!channel || !channel.isTextBased()) {
          return interaction.editReply({
            content: "❌ Kênh Giveaway không hợp lệ."
          });
        }

        const durationMs = parseDuration(durationString);

        if (
          !durationMs ||
          durationMs < MIN_DURATION_MS ||
          durationMs > MAX_DURATION_MS
        ) {
          return interaction.editReply({
            content:
              "❌ Thời gian không hợp lệ (từ 10 giây đến 365 ngày). Ví dụ: `10m`, `1h`, `1d`, `1h30m`."
          });
        }

        const botPermissions = channel.permissionsFor(
          interaction.guild.members.me
        );
        const required = [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.ReadMessageHistory,
          channel.isThread()
            ? PermissionFlagsBits.SendMessagesInThreads
            : PermissionFlagsBits.SendMessages
        ];

        if (!botPermissions?.has(required)) {
          return interaction.editReply({
            content:
              "❌ Bot cần quyền **View Channel, Send Messages, Embed Links, Add Reactions, Read Message History** ở kênh đó."
          });
        }

        const endTime = Date.now() + durationMs;

        const embed = new EmbedBuilder()
          .setTitle("🎉 GIVEAWAY")
          .setDescription(
            `🎁 **Phần thưởng:** ${prize}\n` +
            `🏆 **Người thắng:** ${winnersCount}\n` +
            `⏰ **Kết thúc:** <t:${Math.floor(endTime / 1000)}:R>\n\n` +
            "🎉 React 🎉 để tham gia!"
          )
          .setColor("#5865F2")
          .setFooter({ text: `Host bởi ${interaction.user.tag}` })
          .setTimestamp(endTime);

        const message = await channel.send({ embeds: [embed] });

        try {
          await message.react("🎉");
        } catch (error) {
          console.error("FAILED TO REACT TO GIVEAWAY MESSAGE", error);
          await message.delete().catch(() => {});

          return interaction.editReply({
            content: "❌ Không thể thêm reaction 🎉, đã huỷ Giveaway."
          });
        }

        setGiveaway(message.id, {
          messageId: message.id,
          prize,
          winnersCount,
          endTime,
          channelId: channel.id,
          guildId: interaction.guildId,
          hostId: interaction.user.id,
          ended: false,
          winnerIds: []
        });

        await scheduleGiveaway(client, message.id, endTime);

        return interaction.editReply({
          content: `✅ Đã tạo Giveaway tại ${channel}.`
        });
      }

      // -------------------------------------------------------------- END
      if (sub === "end") {
        const messageId = interaction.options.getString("message_id");
        const giveaway = getGiveaway(messageId);

        if (!giveaway || !belongsToGuild(giveaway, interaction.guildId)) {
          return interaction.editReply({
            content: "❌ Không tìm thấy Giveaway."
          });
        }

        const result = await endGiveaway(client, messageId, { force: true });

        const messages = {
          ended: "✅ Đã kết thúc Giveaway.",
          already_ended: "ℹ️ Giveaway này đã kết thúc trước đó.",
          in_progress: "⏳ Giveaway đang được kết thúc, vui lòng đợi.",
          retry: "❌ Có lỗi tạm thời khi kết thúc Giveaway, bot sẽ tự thử lại.",
          abandoned:
            "⚠️ Không thể kết thúc (tin nhắn/kênh không còn hoặc bot mất quyền). Đã đóng bản ghi Giveaway.",
          not_found: "❌ Không tìm thấy Giveaway."
        };

        return interaction.editReply({
          content: messages[result.status] ?? "❌ Không thể kết thúc Giveaway."
        });
      }

      // ---------------------------------------------------------- REROLL
      if (sub === "reroll") {
        const messageId = interaction.options.getString("message_id");
        const count = interaction.options.getInteger("winners") ?? 1;
        const giveaway = getGiveaway(messageId);

        if (!giveaway || !belongsToGuild(giveaway, interaction.guildId)) {
          return interaction.editReply({
            content: "❌ Không tìm thấy Giveaway."
          });
        }

        const result = await rerollGiveaway(client, messageId, count);

        const messages = {
          ok: "✅ Reroll thành công.",
          not_found: "❌ Không tìm thấy Giveaway.",
          not_ended: "❌ Giveaway chưa kết thúc. Hãy dùng `/giveaway end` trước.",
          channel_missing: "❌ Không tìm thấy kênh Giveaway.",
          message_missing: "❌ Giveaway message đã bị xóa.",
          no_candidates: "❌ Không còn ai đủ điều kiện để reroll."
        };

        return interaction.editReply({
          content: messages[result.status] ?? "❌ Không thể reroll."
        });
      }

      // ------------------------------------------------------------ LIST
      if (sub === "list") {
        const active = Object.entries(loadGiveaways()).filter(
          ([, giveaway]) =>
            giveaway &&
            giveaway.ended !== true &&
            giveaway.guildId === interaction.guildId
        );

        if (active.length === 0) {
          return interaction.editReply({
            content: "📭 Không có Giveaway đang chạy."
          });
        }

        let text = "";
        let shown = 0;

        for (const [id, giveaway] of active) {
          const chunk =
            `**${shown + 1}. ${giveaway.prize}**\n` +
            `> 🏆 Người thắng: **${giveaway.winnersCount}**\n` +
            `> ⏰ <t:${Math.floor(Number(giveaway.endTime) / 1000)}:R>\n` +
            `> 🆔 ID: \`${id}\`\n\n`;

          if ((text + chunk).length > 1800) {
            text += `… và ${active.length - shown} Giveaway khác.`;
            break;
          }

          text += chunk;
          shown++;
        }

        return interaction.editReply({
          content: `📋 **GIVEAWAY ĐANG CHẠY**\n\n${text}`.trimEnd()
        });
      }

      // --------------------------------------------------------- RECOVER
      if (sub === "recover") {
        const messageId = interaction.options.getString("message_id");
        const prizeOption = interaction.options.getString("prize");
        const winnersOption = interaction.options.getInteger("winners");
        const durationOption = interaction.options.getString("duration");

        if (!isValidMessageId(messageId)) {
          return interaction.editReply({ content: "❌ Message ID không hợp lệ." });
        }

        const existing = getGiveaway(messageId);

        if (existing && !belongsToGuild(existing, interaction.guildId)) {
          return interaction.editReply({
            content: "❌ Message ID này thuộc về server khác."
          });
        }

        if (existing?.ended === true) {
          return interaction.editReply({
            content: "❌ Giveaway này đã kết thúc. Hãy dùng `/giveaway reroll` nếu cần."
          });
        }

        let message;

        try {
          message = await interaction.channel.messages.fetch(messageId);
        } catch (error) {
          if (error?.code === 10008) {
            return interaction.editReply({
              content: "❌ Không thấy message này trong kênh hiện tại."
            });
          }
          throw error;
        }

        if (message.author?.id !== client.user.id) {
          return interaction.editReply({
            content: "❌ Đây không phải tin nhắn Giveaway của bot."
          });
        }

        const embed = message.embeds[0];

        if (embed?.title?.includes("ĐÃ KẾT THÚC")) {
          return interaction.editReply({
            content: "❌ Giveaway này đã kết thúc (embed đã ở trạng thái kết thúc)."
          });
        }

        const embedText = embed?.description || "";

        let prize = prizeOption || "Recovered Giveaway";
        if (!prizeOption) {
          const match = embedText.match(/\*\*Phần thưởng:\*\*\s*(.+)/i);
          if (match) prize = match[1].trim().slice(0, 200);
        }

        let winnersCount = winnersOption || 1;
        if (!winnersOption) {
          const match = embedText.match(/\*\*Người thắng:\*\*\s*(\d+)/i);
          if (match) {
            winnersCount = Math.min(Math.max(Number(match[1]), 1), 20);
          }
        }

        let endTime;

        if (durationOption) {
          const durationMs = parseDuration(durationOption);

          if (!durationMs || durationMs > MAX_DURATION_MS) {
            return interaction.editReply({
              content: "❌ Duration recover không hợp lệ (tối đa 365d)."
            });
          }

          endTime = Date.now() + durationMs;
        } else {
          const match = embedText.match(/<t:(\d+):[a-zA-Z]>/);

          if (!match) {
            return interaction.editReply({
              content:
                "❌ Không đọc được giờ kết thúc từ embed. Hãy nhập `duration`, ví dụ `5h`."
            });
          }

          endTime = Number(match[1]) * 1000;
        }

        const participants = await fetchReactionUserIds(message);

        setGiveaway(messageId, {
          messageId,
          prize,
          winnersCount,
          endTime,
          channelId: interaction.channelId,
          guildId: interaction.guildId,
          hostId: interaction.user.id,
          ended: false,
          winnerIds: []
        });

        const overdue = endTime <= Date.now();

        await scheduleGiveaway(client, messageId, endTime);

        return interaction.editReply({
          content:
            `✅ Đã recover Giveaway${overdue ? " (đã quá hạn nên bot kết thúc ngay)" : ""}.\n` +
            `👥 Người tham gia hiện tại: ${participants.length}\n` +
            `🎁 Phần thưởng: ${prize}\n` +
            `🏆 Người thắng: ${winnersCount}\n` +
            `⏰ Kết thúc: <t:${Math.floor(endTime / 1000)}:R>`
        });
      }

      return interaction.editReply({ content: "❌ Lệnh không hợp lệ." });
    } catch (error) {
      console.error("GIVEAWAY COMMAND ERROR:", error);

      try {
        return await interaction.editReply({
          content: "❌ Đã xảy ra lỗi khi xử lý Giveaway."
        });
      } catch (replyError) {
        console.error("FAILED TO EDIT GIVEAWAY ERROR REPLY:", replyError);
      }
    }
  }
};
