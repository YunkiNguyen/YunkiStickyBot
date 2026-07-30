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

// =====================================================
// INTERACTION DUPLICATE PROTECTION
// =====================================================

const processedInteractions = new Set();
const MAX_INTERACTION_CACHE = 5000;

function markInteraction(interactionId) {
  if (processedInteractions.has(interactionId)) {
    return false;
  }

  processedInteractions.add(interactionId);

  if (processedInteractions.size > MAX_INTERACTION_CACHE) {
    const first = processedInteractions.values().next().value;

    if (first) {
      processedInteractions.delete(first);
    }
  }

  return true;
}

// =====================================================
// DURATION
// =====================================================

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

// =====================================================
// WINNER PICKER
// =====================================================

function pickWinners(users, count) {
  const shuffled = [...users];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  return shuffled.slice(
    0,
    Math.min(count, shuffled.length)
  );
}

// =====================================================
// END GIVEAWAY
// =====================================================

export async function endGiveaway(client, messageId) {
  const giveaway = getGiveaway(messageId);

  if (!giveaway || giveaway.ended) {
    return;
  }

  // Đánh dấu trước để tránh nhiều timer xử lý cùng giveaway
  giveaway.ended = true;
  setGiveaway(messageId, giveaway);

  try {
    const channel = await client.channels.fetch(
      giveaway.channelId
    );

    if (!channel || !channel.isTextBased()) {
      console.error(
        `INVALID GIVEAWAY CHANNEL: ${giveaway.channelId}`
      );
      return;
    }

    const message = await channel.messages.fetch(
      messageId
    );

    const reaction = message.reactions.cache.get("🎉");

    let users = [];

    if (reaction) {
      const fetched = await reaction.users.fetch();

      users = [
        ...fetched
          .filter(user => !user.bot)
          .keys()
      ];
    }

    let winners = [];
    let description;

    if (users.length === 0) {
      description =
        "😢 Không có ai tham gia giveaway này.";
    } else {
      winners = pickWinners(
        users,
        giveaway.winnersCount
      );

      const winnerMentions = winners
        .map(id => `<@${id}>`)
        .join(", ");

      description =
        `🎉 **Người thắng:** ${winnerMentions}\n` +
        `🎁 **Phần thưởng:** ${giveaway.prize}`;
    }

    const endedEmbed = EmbedBuilder.from(
      message.embeds[0] || {}
    )
      .setTitle("🎉 GIVEAWAY ĐÃ KẾT THÚC")
      .setDescription(description)
      .setColor("#57F287");

    await message.edit({
      embeds: [endedEmbed]
    });

    if (winners.length > 0) {
      const mentions = winners
        .map(id => `<@${id}>`)
        .join(", ");

      await channel.send({
        content:
          `🎊 Chúc mừng ${mentions} đã thắng **${giveaway.prize}**!`
      });
    }

    console.log(
      `GIVEAWAY ENDED: ${messageId}`
    );

  } catch (error) {
    console.error(
      `GIVEAWAY END ERROR: ${messageId}`
    );

    console.error(error);
  }
}

// =====================================================
// COMMAND
// =====================================================

export default {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription(
      "Hệ thống Giveaway của Yunki Bot"
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )

    // =================================================
    // START
    // =================================================

    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription(
          "Bắt đầu một giveaway mới"
        )

        .addStringOption(option =>
          option
            .setName("prize")
            .setDescription("Phần thưởng")
            .setRequired(true)
        )

        .addStringOption(option =>
          option
            .setName("duration")
            .setDescription(
              "Thời gian: 10s, 10m, 1h, 1d"
            )
            .setRequired(true)
        )

        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription(
              "Số người thắng"
            )
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20)
        )

        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription(
              "Kênh đăng Giveaway"
            )
            .setRequired(false)
        )
    )

    // =================================================
    // END
    // =================================================

    .addSubcommand(sub =>
      sub
        .setName("end")
        .setDescription(
          "Kết thúc Giveaway sớm"
        )
        .addStringOption(option =>
          option
            .setName("message_id")
            .setDescription(
              "ID tin nhắn Giveaway"
            )
            .setRequired(true)
        )
    )

    // =================================================
    // REROLL
    // =================================================

    .addSubcommand(sub =>
      sub
        .setName("reroll")
        .setDescription(
          "Quay lại người thắng mới"
        )
        .addStringOption(option =>
          option
            .setName("message_id")
            .setDescription(
              "ID tin nhắn Giveaway"
            )
            .setRequired(true)
        )
    )

    // =================================================
    // LIST
    // =================================================

    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription(
          "Xem Giveaway đang chạy"
        )
    ),

  // ===================================================
  // EXECUTE
  // ===================================================

  async execute(interaction, client) {
    // -------------------------------------------------
    // CHỐNG XỬ LÝ TRÙNG INTERACTION
    // -------------------------------------------------

    if (!markInteraction(interaction.id)) {
      console.warn(
        `DUPLICATE INTERACTION IGNORED: ${interaction.id}`
      );

      return;
    }

    // -------------------------------------------------
    // DEFER NGAY LẬP TỨC
    // -------------------------------------------------

    try {
      await interaction.deferReply({
        ephemeral: true
      });
    } catch (error) {
      console.error(
        "FAILED TO DEFER GIVEAWAY INTERACTION:"
      );

      console.error(error);

      return;
    }

    try {
      const sub = interaction.options.getSubcommand();

      // =================================================
      // START
      // =================================================

      if (sub === "start") {
        const prize =
          interaction.options.getString("prize");

        const durationString =
          interaction.options.getString("duration");

        const winnersCount =
          interaction.options.getInteger("winners");

        const channel =
          interaction.options.getChannel("channel") ||
          interaction.channel;

        if (
          !channel ||
          !channel.isTextBased()
        ) {
          return interaction.editReply({
            content:
              "❌ Kênh Giveaway không hợp lệ."
          });
        }

        const durationMs =
          parseDuration(durationString);

        if (
          !durationMs ||
          durationMs < 10000
        ) {
          return interaction.editReply({
            content:
              "❌ Thời gian không hợp lệ.\n" +
              "Ví dụ: `10s`, `10m`, `1h`, `1d`."
          });
        }

        const endTime =
          Date.now() + durationMs;

        const embed =
          new EmbedBuilder()
            .setTitle("🎉 GIVEAWAY")
            .setDescription(
              `🎁 **Phần thưởng:** ${prize}\n` +
              `🏆 **Số người thắng:** ${winnersCount}\n` +
              `⏰ **Kết thúc:** <t:${Math.floor(
                endTime / 1000
              )}:R>\n\n` +
              `🎉 React 🎉 để tham gia!`
            )
            .setColor("#5865F2")
            .setFooter({
              text:
                `Host bởi ${interaction.user.tag}`
            })
            .setTimestamp(endTime);

        // Chỉ gửi đúng 1 giveaway message
        const message =
          await channel.send({
            embeds: [embed]
          });

        await message.react("🎉");

        setGiveaway(message.id, {
          prize,
          winnersCount,
          endTime,
          channelId: channel.id,
          guildId: interaction.guildId,
          hostId: interaction.user.id,
          ended: false
        });

        console.log(
          `GIVEAWAY CREATED: ${message.id}`
        );

        setTimeout(() => {
          endGiveaway(
            client,
            message.id
          );
        }, durationMs);

        return interaction.editReply({
          content:
            `✅ Đã tạo Giveaway tại ${channel}.`
        });
      }

      // =================================================
      // END
      // =================================================

      if (sub === "end") {
        const messageId =
          interaction.options.getString(
            "message_id"
          );

        const giveaway =
          getGiveaway(messageId);

        if (
          !giveaway ||
          giveaway.ended
        ) {
          return interaction.editReply({
            content:
              "❌ Không tìm thấy Giveaway đang chạy."
          });
        }

        await endGiveaway(
          client,
          messageId
        );

        return interaction.editReply({
          content:
            "✅ Đã kết thúc Giveaway."
        });
      }

      // =================================================
      // REROLL
      // =================================================

      if (sub === "reroll") {
        const messageId =
          interaction.options.getString(
            "message_id"
          );

        const giveaway =
          getGiveaway(messageId);

        if (!giveaway) {
          return interaction.editReply({
            content:
              "❌ Không tìm thấy Giveaway."
          });
        }

        const channel =
          await client.channels.fetch(
            giveaway.channelId
          );

        if (
          !channel ||
          !channel.isTextBased()
        ) {
          return interaction.editReply({
            content:
              "❌ Không tìm thấy kênh Giveaway."
          });
        }

        const message =
          await channel.messages.fetch(
            messageId
          );

        const reaction =
          message.reactions.cache.get(
            "🎉"
          );

        let users = [];

        if (reaction) {
          const fetched =
            await reaction.users.fetch();

          users = [
            ...fetched
              .filter(user => !user.bot)
              .keys()
          ];
        }

        if (users.length === 0) {
          return interaction.editReply({
            content:
              "❌ Không có ai tham gia để reroll."
          });
        }

        const winners =
          pickWinners(
            users,
            giveaway.winnersCount
          );

        const winnerMentions =
          winners
            .map(id => `<@${id}>`)
            .join(", ");

        await channel.send({
          content:
            `🎊 **Reroll!** Người thắng mới của **${giveaway.prize}** là: ${winnerMentions}`
        });

        return interaction.editReply({
          content:
            "✅ Đã reroll thành công."
        });
      }

      // =================================================
      // LIST
      // =================================================

      if (sub === "list") {
        const all =
          loadGiveaways();

        const now = Date.now();

        const active =
          Object.entries(all).filter(
            ([, giveaway]) =>
              giveaway &&
              giveaway.ended !== true &&
              Number(giveaway.endTime) > now
          );

        if (active.length === 0) {
          return interaction.editReply({
            content:
              "📭 Hiện không có Giveaway nào đang chạy."
          });
        }

        const text =
          active
            .map(
              (
                [messageId, giveaway],
                index
              ) => {
                const endTimestamp =
                  Math.floor(
                    Number(
                      giveaway.endTime
                    ) / 1000
                  );

                return (
                  `**${index + 1}. ${giveaway.prize}**\n` +
                  `> 🏆 Người thắng: **${giveaway.winnersCount}**\n` +
                  `> ⏰ Kết thúc: <t:${endTimestamp}:R>\n` +
                  `> 🆔 ID: \`${messageId}\``
                );
              }
            )
            .join("\n\n");

        return interaction.editReply({
          content:
            `📋 **GIVEAWAY ĐANG CHẠY**\n\n${text}`
        });
      }

      // =================================================
      // UNKNOWN
      // =================================================

      return interaction.editReply({
        content:
          "❌ Subcommand không hợp lệ."
      });

    } catch (error) {
      console.error(
        "GIVEAWAY COMMAND ERROR:"
      );

      console.error(error);

      try {
        return await interaction.editReply({
          content:
            "❌ Đã xảy ra lỗi khi xử lý Giveaway."
        });
      } catch (replyError) {
        console.error(
          "FAILED TO EDIT GIVEAWAY ERROR REPLY:"
        );

        console.error(replyError);
      }
    }
  }
};