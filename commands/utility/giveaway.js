import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";

import {
  getGiveaway,
  setGiveaway,
  loadGiveaways
} from "../../utils/giveawayStore.js";

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

function parseDuration(value) {
  if (!value) return null;

  const match = value.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

function pickWinners(users, count) {
  const shuffled = [...users];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function markGiveawayEnded(messageId, giveaway, winners = []) {
  giveaway.ended = true;
  giveaway.ending = false;
  giveaway.winnerIds = winners;
  giveaway.endedAt = Date.now();
  setGiveaway(messageId, giveaway);
}

export async function endGiveaway(client, messageId) {
  const giveaway = getGiveaway(messageId);

  if (!giveaway || giveaway.ended === true) return;

  // Prevent two timers / resume handlers from ending the same giveaway.
  if (giveaway.ending === true) return;

  giveaway.ending = true;
  setGiveaway(messageId, giveaway);

  try {
    const channel = await client.channels.fetch(giveaway.channelId);

    if (!channel || !channel.isTextBased()) {
      console.error(
        `INVALID GIVEAWAY CHANNEL: ${giveaway.channelId}`
      );
      markGiveawayEnded(messageId, giveaway);
      return;
    }

    let message;

    try {
      message = await channel.messages.fetch(messageId);
    } catch (error) {
      // Discord 10008 = Unknown Message. The giveaway message was deleted.
      if (error?.code === 10008) {
        console.log(
          `GIVEAWAY MESSAGE DELETED, CLEANING STORE: ${messageId}`
        );

        markGiveawayEnded(messageId, giveaway);
        return;
      }

      throw error;
    }

    const reaction = message.reactions.cache.get("🎉");
    let users = [];

    if (reaction) {
      try {
        const fetched = await reaction.users.fetch();
        users = [
          ...fetched
            .filter(user => !user.bot)
            .keys()
        ];
      } catch (error) {
        console.error(
          `FAILED TO FETCH GIVEAWAY USERS: ${messageId}`,
          error
        );
      }
    }

    const winners = pickWinners(
      users,
      Number(giveaway.winnersCount) || 1
    );

    const description = winners.length
      ? `🎉 **Người thắng:** ${winners.map(id => `<@${id}>`).join(", ")}\n\n🎁 **Phần thưởng:** ${giveaway.prize}`
      : "😢 Không có ai tham gia Giveaway.";

    const endedEmbed = EmbedBuilder.from(message.embeds[0] || {})
      .setTitle("🎉 GIVEAWAY ĐÃ KẾT THÚC")
      .setDescription(description)
      .setColor("#57F287");

    try {
      await message.edit({ embeds: [endedEmbed] });
    } catch (error) {
      if (error?.code === 10008) {
        console.log(
          `GIVEAWAY MESSAGE DELETED DURING END: ${messageId}`
        );

        markGiveawayEnded(messageId, giveaway, winners);
        return;
      }

      throw error;
    }

    if (winners.length > 0) {
      try {
        await channel.send({
          content:
            `🎊 Chúc mừng ${winners.map(id => `<@${id}>`).join(", ")} đã thắng **${giveaway.prize}**!`
        });
      } catch (error) {
        console.error(
          `FAILED TO ANNOUNCE GIVEAWAY WINNERS: ${messageId}`,
          error
        );
      }
    }

    markGiveawayEnded(messageId, giveaway, winners);

    console.log(`GIVEAWAY ENDED: ${messageId}`);
  } catch (error) {
    // Do not leave the giveaway permanently locked if a transient error occurs.
    giveaway.ending = false;
    setGiveaway(messageId, giveaway);

    console.error(`END GIVEAWAY ERROR: ${messageId}`);
    console.error(error);
  }
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
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("duration")
            .setDescription("Ví dụ: 10m, 1h, 7d")
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
        .setDescription("Chọn lại người thắng")
        .addStringOption(option =>
          option
            .setName("message_id")
            .setDescription("ID message Giveaway")
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("Xem Giveaway đang chạy")
    )

    .addSubcommand(sub =>
      sub
        .setName("recover")
        .setDescription("Khôi phục Giveaway bị mất dữ liệu")
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
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription("Số người thắng")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addStringOption(option =>
          option
            .setName("duration")
            .setDescription("Thời gian còn lại, ví dụ 11d hoặc 5h")
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    if (!markInteraction(interaction.id)) {
      console.warn(
        `DUPLICATE GIVEAWAY INTERACTION: ${interaction.id}`
      );
      return;
    }

    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("DEFER GIVEAWAY ERROR:", error);
      return;
    }

    try {
      const sub = interaction.options.getSubcommand();

      if (sub === "start") {
        const prize = interaction.options.getString("prize");
        const durationString = interaction.options.getString("duration");
        const winnersCount = interaction.options.getInteger("winners");
        const channel =
          interaction.options.getChannel("channel") ||
          interaction.channel;

        if (!channel || !channel.isTextBased()) {
          return interaction.editReply({
            content: "❌ Kênh Giveaway không hợp lệ."
          });
        }

        const durationMs = parseDuration(durationString);

        if (!durationMs || durationMs < 10000) {
          return interaction.editReply({
            content:
              "❌ Thời gian không hợp lệ. Ví dụ: `10s`, `10m`, `1h`, `1d`."
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
          .setFooter({
            text: `Host bởi ${interaction.user.tag}`
          })
          .setTimestamp(endTime);

        const message = await channel.send({
          embeds: [embed]
        });

        await message.react("🎉");

        setGiveaway(message.id, {
          messageId: message.id,
          prize,
          winnersCount,
          endTime,
          channelId: channel.id,
          guildId: interaction.guildId,
          hostId: interaction.user.id,
          ended: false,
          ending: false,
          winnerIds: []
        });

        // Keep the existing index.js resume scheduler as the source of truth,
        // while also ending giveaways created during the current process.
        setTimeout(() => {
          endGiveaway(client, message.id).catch(error => {
            console.error(
              `FAILED TO END GIVEAWAY: ${message.id}`,
              error
            );
          });
        }, Math.min(durationMs, 2147483647));

        return interaction.editReply({
          content: `✅ Đã tạo Giveaway tại ${channel}.`
        });
      }

      if (sub === "end") {
        const messageId = interaction.options.getString("message_id");
        const giveaway = getGiveaway(messageId);

        if (!giveaway) {
          return interaction.editReply({
            content: "❌ Không tìm thấy Giveaway."
          });
        }

        await endGiveaway(client, messageId);

        return interaction.editReply({
          content: "✅ Đã kết thúc Giveaway."
        });
      }

      if (sub === "reroll") {
        const messageId = interaction.options.getString("message_id");
        const giveaway = getGiveaway(messageId);

        if (!giveaway) {
          return interaction.editReply({
            content: "❌ Không tìm thấy Giveaway."
          });
        }

        let channel;
        let message;

        try {
          channel = await client.channels.fetch(giveaway.channelId);
          if (!channel || !channel.isTextBased()) {
            return interaction.editReply({
              content: "❌ Không tìm thấy kênh Giveaway."
            });
          }

          message = await channel.messages.fetch(messageId);
        } catch (error) {
          if (error?.code === 10008) {
            markGiveawayEnded(messageId, giveaway);
            return interaction.editReply({
              content: "❌ Giveaway message đã bị xóa."
            });
          }
          throw error;
        }

        const reaction = message.reactions.cache.get("🎉");

        if (!reaction) {
          return interaction.editReply({
            content: "❌ Không có người tham gia."
          });
        }

        const users = [
          ...(await reaction.users.fetch())
            .filter(user => !user.bot)
            .keys()
        ];

        if (users.length === 0) {
          return interaction.editReply({
            content: "❌ Không có người tham gia để reroll."
          });
        }

        const winners = pickWinners(
          users,
          Number(giveaway.winnersCount) || 1
        );

        await channel.send({
          content:
            `🎊 **Reroll!** Người thắng mới của **${giveaway.prize}** là: ${winners.map(id => `<@${id}>`).join(", ")}`
        });

        return interaction.editReply({
          content: "✅ Reroll thành công."
        });
      }

      if (sub === "list") {
        const data = loadGiveaways();
        const active = Object.entries(data).filter(
          ([, giveaway]) =>
            giveaway &&
            giveaway.ended !== true &&
            giveaway.ending !== true &&
            Number(giveaway.endTime) > Date.now()
        );

        if (active.length === 0) {
          return interaction.editReply({
            content: "📭 Không có Giveaway đang chạy."
          });
        }

        const text = active
          .map(([id, giveaway], index) =>
            `**${index + 1}. ${giveaway.prize}**\n` +
            `> 🏆 Người thắng: **${giveaway.winnersCount}**\n` +
            `> ⏰ <t:${Math.floor(Number(giveaway.endTime) / 1000)}:R>\n` +
            `> 🆔 ID: \`${id}\``
          )
          .join("\n\n");

        return interaction.editReply({
          content: `📋 **GIVEAWAY ĐANG CHẠY**\n\n${text}`
        });
      }

      if (sub === "recover") {
        const messageId = interaction.options.getString("message_id");
        const prizeOption = interaction.options.getString("prize");
        const winnersOption = interaction.options.getInteger("winners");
        const durationOption = interaction.options.getString("duration");

        try {
          const message = await interaction.channel.messages.fetch(messageId);
          const reaction = message.reactions.cache.get("🎉");

          let participants = [];

          if (reaction) {
            const users = await reaction.users.fetch();
            participants = [
              ...users
                .filter(user => !user.bot)
                .keys()
            ];
          }

          const embed = message.embeds[0];
          const embedText = embed?.description || "";

          let prize = prizeOption || "Recovered Giveaway";
          if (!prizeOption) {
            const match = embedText.match(/\*\*Phần thưởng:\*\*\s*(.+)/i);
            if (match) prize = match[1].trim();
          }

          let winnersCount = winnersOption || 1;
          if (!winnersOption) {
            const match = embedText.match(/\*\*Người thắng:\*\*\s*(\d+)/i);
            if (match) winnersCount = Number(match[1]);
          }

          const durationMs = durationOption
            ? parseDuration(durationOption)
            : 11 * 24 * 60 * 60 * 1000;

          if (!durationMs) {
            return interaction.editReply({
              content: "❌ Duration recover không hợp lệ."
            });
          }

          setGiveaway(messageId, {
            messageId,
            prize,
            winnersCount,
            endTime: Date.now() + durationMs,
            channelId: message.channel.id,
            guildId: interaction.guildId,
            hostId: interaction.user.id,
            participants,
            participantCount: participants.length,
            winnerIds: [],
            ended: false,
            ending: false
          });

          return interaction.editReply({
            content:
              `✅ Đã recover Giveaway.\n` +
              `👥 Người tham gia: ${participants.length}\n` +
              `🎁 Phần thưởng: ${prize}\n` +
              `🏆 Người thắng: ${winnersCount}`
          });
        } catch (error) {
          if (error?.code === 10008) {
            return interaction.editReply({
              content: "❌ Message Giveaway không tồn tại."
            });
          }

          throw error;
        }
      }

      return interaction.editReply({
        content: "❌ Lệnh không hợp lệ."
      });
    } catch (error) {
      console.error("GIVEAWAY COMMAND ERROR:", error);
      console.error(error);

      try {
        return await interaction.editReply({
          content: "❌ Đã xảy ra lỗi khi xử lý Giveaway."
        });
      } catch (replyError) {
        console.error(
          "FAILED TO EDIT GIVEAWAY ERROR REPLY:",
          replyError
        );
      }
    }
  }
};
