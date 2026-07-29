import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} from "discord.js";

import {
  getGiveaway,
  setGiveaway,
  loadGiveaways,
  getActiveGiveaways
} from "../../utils/giveawayStore.js";

// =====================================================
// TIMER STORAGE
// =====================================================

const giveawayTimers = new Map();

const MAX_TIMEOUT =
  2147483647;

// =====================================================
// DURATION
// =====================================================

function parseDuration(input) {
  if (!input) return null;

  const match =
    input
      .trim()
      .match(/^(\d+)\s*(s|m|h|d)$/i);

  if (!match) {
    return null;
  }

  const value =
    Number(match[1]);

  const unit =
    match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return (
    value *
    multipliers[unit]
  );
}

// =====================================================
// WINNER PICKER
// =====================================================

function pickWinners(
  users,
  count,
  excluded = []
) {
  const excludedSet =
    new Set(excluded);

  const available =
    users.filter(
      id => !excludedSet.has(id)
    );

  const shuffled =
    [...available];

  for (
    let i = shuffled.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      shuffled[i],
      shuffled[j]
    ] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  return shuffled.slice(
    0,
    Math.min(
      count,
      shuffled.length
    )
  );
}

// =====================================================
// TIMER
// =====================================================

function clearGiveawayTimer(
  messageId
) {
  const timer =
    giveawayTimers.get(
      messageId
    );

  if (timer) {
    clearTimeout(timer);
    giveawayTimers.delete(
      messageId
    );
  }
}

function scheduleGiveaway(
  client,
  messageId,
  endTime
) {
  clearGiveawayTimer(
    messageId
  );

  const remaining =
    endTime - Date.now();

  if (remaining <= 0) {
    endGiveaway(
      client,
      messageId
    );

    return;
  }

  const delay =
    Math.min(
      remaining,
      MAX_TIMEOUT
    );

  const timer =
    setTimeout(() => {
      scheduleGiveaway(
        client,
        messageId,
        endTime
      );

      if (
        endTime <= Date.now()
      ) {
        endGiveaway(
          client,
          messageId
        );
      }
    }, delay);

  giveawayTimers.set(
    messageId,
    timer
  );
}

// =====================================================
// GET PARTICIPANTS
// =====================================================

async function getParticipants(
  message
) {
  const reaction =
    message.reactions.cache.get(
      "🎉"
    );

  if (!reaction) {
    return [];
  }

  try {
    const users =
      await reaction.users.fetch();

    return [
      ...users
        .filter(
          user => !user.bot
        )
        .keys()
    ];
  } catch (error) {
    console.error(
      "❌ Không thể lấy người tham gia giveaway:",
      error
    );

    return [];
  }
}

// =====================================================
// END GIVEAWAY
// =====================================================

export async function endGiveaway(
  client,
  messageId
) {
  clearGiveawayTimer(
    messageId
  );

  const giveaway =
    getGiveaway(messageId);

  if (
    !giveaway ||
    giveaway.ended
  ) {
    return false;
  }

  try {
    const channel =
      await client.channels.fetch(
        giveaway.channelId
      );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      giveaway.ended = true;

      setGiveaway(
        messageId,
        giveaway
      );

      return false;
    }

    const message =
      await channel.messages.fetch(
        messageId
      );

    const participants =
      await getParticipants(
        message
      );

    const winners =
      pickWinners(
        participants,
        giveaway.winnersCount
      );

    giveaway.ended = true;

    giveaway.endedAt =
      Date.now();

    giveaway.participantCount =
      participants.length;

    giveaway.winnerIds =
      winners;

    setGiveaway(
      messageId,
      giveaway
    );

    let description;

    if (
      participants.length === 0
    ) {
      description =
        [
          "❌ **Không có ai tham gia giveaway.**",
          "",
          `🎁 **Phần thưởng:** ${giveaway.prize}`
        ].join("\n");
    } else if (
      winners.length === 0
    ) {
      description =
        [
          "❌ Không thể chọn người thắng.",
          "",
          `🎁 **Phần thưởng:** ${giveaway.prize}`
        ].join("\n");
    } else {
      const winnerMentions =
        winners
          .map(
            id => `<@${id}>`
          )
          .join(", ");

      description =
        [
          `🎉 **Người thắng:** ${winnerMentions}`,
          "",
          `🎁 **Phần thưởng:** ${giveaway.prize}`,
          `👥 **Người tham gia:** ${participants.length}`
        ].join("\n");
    }

    const oldEmbed =
      message.embeds[0];

    const endedEmbed =
      oldEmbed
        ? EmbedBuilder
            .from(oldEmbed)
            .setTitle(
              "🎉 GIVEAWAY ĐÃ KẾT THÚC"
            )
            .setDescription(
              description
            )
            .setColor(
              "#57F287"
            )
        : new EmbedBuilder()
            .setTitle(
              "🎉 GIVEAWAY ĐÃ KẾT THÚC"
            )
            .setDescription(
              description
            )
            .setColor(
              "#57F287"
            );

    await message.edit({
      embeds: [endedEmbed]
    });

    if (
      winners.length > 0
    ) {
      const mentions =
        winners
          .map(
            id => `<@${id}>`
          )
          .join(", ");

      await channel.send(
        `🎊 Chúc mừng ${mentions}! Bạn đã thắng **${giveaway.prize}**!`
      );
    }

    return true;
  } catch (error) {
    console.error(
      `❌ Lỗi khi kết thúc giveaway ${messageId}:`,
      error
    );

    // Nếu message đã bị xóa,
    // đánh dấu giveaway kết thúc
    // để bot không cố chạy lại vô hạn.
    if (
      error?.code === 10008 ||
      error?.code === 10003
    ) {
      giveaway.ended = true;
      giveaway.endedAt =
        Date.now();

      setGiveaway(
        messageId,
        giveaway
      );
    }

    return false;
  }
}

// =====================================================
// RESTORE GIVEAWAYS AFTER RESTART
// =====================================================

export async function restoreGiveaways(
  client
) {
  const active =
    getActiveGiveaways();

  console.log(
    `🎉 Đang khôi phục ${active.length} giveaway...`
  );

  for (const giveaway of active) {
    if (
      !giveaway.endTime
    ) {
      continue;
    }

    if (
      giveaway.endTime <=
      Date.now()
    ) {
      await endGiveaway(
        client,
        giveaway.messageId
      );

      continue;
    }

    scheduleGiveaway(
      client,
      giveaway.messageId,
      giveaway.endTime
    );
  }

  console.log(
    "✅ Giveaway scheduler đã sẵn sàng."
  );
}

// =====================================================
// COMMAND
// =====================================================

export default {
  data:
    new SlashCommandBuilder()
      .setName("giveaway")
      .setDescription(
        "Hệ thống Giveaway của Yunki Bot"
      )
      .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
      )

      // ============================
      // START
      // ============================

      .addSubcommand(
        sub =>
          sub
            .setName("start")
            .setDescription(
              "Bắt đầu một giveaway mới"
            )

            .addStringOption(
              option =>
                option
                  .setName("prize")
                  .setDescription(
                    "Phần thưởng"
                  )
                  .setRequired(true)
                  .setMaxLength(
                    256
                  )
            )

            .addStringOption(
              option =>
                option
                  .setName("duration")
                  .setDescription(
                    "Thời gian: 10s, 10m, 1h, 1d"
                  )
                  .setRequired(true)
            )

            .addIntegerOption(
              option =>
                option
                  .setName("winners")
                  .setDescription(
                    "Số người thắng"
                  )
                  .setRequired(true)
                  .setMinValue(1)
                  .setMaxValue(20)
            )

            .addChannelOption(
              option =>
                option
                  .setName("channel")
                  .setDescription(
                    "Kênh đăng giveaway"
                  )
                  .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                  )
                  .setRequired(false)
            )
      )

      // ============================
      // END
      // ============================

      .addSubcommand(
        sub =>
          sub
            .setName("end")
            .setDescription(
              "Kết thúc giveaway sớm"
            )
            .addStringOption(
              option =>
                option
                  .setName("message_id")
                  .setDescription(
                    "ID tin nhắn giveaway"
                  )
                  .setRequired(true)
            )
      )

      // ============================
      // REROLL
      // ============================

      .addSubcommand(
        sub =>
          sub
            .setName("reroll")
            .setDescription(
              "Chọn người thắng mới"
            )
            .addStringOption(
              option =>
                option
                  .setName("message_id")
                  .setDescription(
                    "ID tin nhắn giveaway"
                  )
                  .setRequired(true)
            )
      )

      // ============================
      // LIST
      // ============================

      .addSubcommand(
        sub =>
          sub
            .setName("list")
            .setDescription(
              "Xem giveaway đang chạy"
            )
      ),

  async execute(
    interaction,
    client
  ) {
    const subcommand =
      interaction.options.getSubcommand();

    // =================================================
    // START
    // =================================================

    if (
      subcommand === "start"
    ) {
      const prize =
        interaction.options.getString(
          "prize"
        );

      const durationString =
        interaction.options.getString(
          "duration"
        );

      const winnersCount =
        interaction.options.getInteger(
          "winners"
        );

      const channel =
        interaction.options.getChannel(
          "channel"
        ) ||
        interaction.channel;

      const durationMs =
        parseDuration(
          durationString
        );

      if (
        !durationMs ||
        durationMs < 10000
      ) {
        return interaction.reply({
          content:
            "❌ Thời gian không hợp lệ.\nVí dụ: `10s`, `10m`, `1h`, `1d`.",
          ephemeral: true
        });
      }

      if (
        durationMs >
        30 * 24 * 60 * 60 * 1000
      ) {
        return interaction.reply({
          content:
            "❌ Giveaway không được dài quá **30 ngày**.",
          ephemeral: true
        });
      }

      if (
        !channel ||
        !channel.isTextBased()
      ) {
        return interaction.reply({
          content:
            "❌ Kênh được chọn không hợp lệ.",
          ephemeral: true
        });
      }

      const botPermissions =
        channel.permissionsFor(
          interaction.guild.members.me
        );

      if (
        !botPermissions?.has(
          PermissionFlagsBits.SendMessages
        ) ||
        !botPermissions?.has(
          PermissionFlagsBits.EmbedLinks
        ) ||
        !botPermissions?.has(
          PermissionFlagsBits.AddReactions
        )
      ) {
        return interaction.reply({
          content:
            "❌ Bot không đủ quyền trong kênh giveaway.\n\n" +
            "Bot cần:\n" +
            "• Send Messages\n" +
            "• Embed Links\n" +
            "• Add Reactions",
          ephemeral: true
        });
      }

      const endTime =
        Date.now() +
        durationMs;

      const embed =
        new EmbedBuilder()
          .setTitle(
            "🎉 GIVEAWAY"
          )
          .setDescription(
            [
              `🎁 **Phần thưởng:** ${prize}`,
              `🏆 **Số người thắng:** ${winnersCount}`,
              `⏰ **Kết thúc:** <t:${Math.floor(
                endTime / 1000
              )}:R>`,
              "",
              "🎉 **React 🎉 để tham gia!**"
            ].join("\n")
          )
          .setColor(
            "#5865F2"
          )
          .setFooter({
            text:
              `Host bởi ${interaction.user.tag}`
          })
          .setTimestamp(
            endTime
          );

      const message =
        await channel.send({
          embeds: [embed]
        });

      await message.react(
        "🎉"
      );

      setGiveaway(
        message.id,
        {
          messageId:
            message.id,

          guildId:
            interaction.guildId,

          channelId:
            channel.id,

          hostId:
            interaction.user.id,

          prize,

          winnersCount,

          endTime,

          createdAt:
            Date.now(),

          ended: false,

          winnerIds: [],

          participantCount: 0
        }
      );

      scheduleGiveaway(
        client,
        message.id,
        endTime
      );

      return interaction.reply({
        content:
          `✅ Đã tạo giveaway tại ${channel}.\n` +
          `🆔 Message ID: \`${message.id}\``,
        ephemeral: true
      });
    }

    // =================================================
    // END
    // =================================================

    if (
      subcommand === "end"
    ) {
      const messageId =
        interaction.options.getString(
          "message_id"
        );

      const giveaway =
        getGiveaway(
          messageId
        );

      if (!giveaway) {
        return interaction.reply({
          content:
            "❌ Không tìm thấy giveaway này.",
          ephemeral: true
        });
      }

      if (
        giveaway.ended
      ) {
        return interaction.reply({
          content:
            "⚠️ Giveaway này đã kết thúc.",
          ephemeral: true
        });
      }

      const canManage =
        interaction.memberPermissions.has(
          PermissionFlagsBits.ManageGuild
        );

      const isHost =
        giveaway.hostId ===
        interaction.user.id;

      if (
        !canManage &&
        !isHost
      ) {
        return interaction.reply({
          content:
            "❌ Chỉ Host hoặc người có quyền **Manage Server** mới có thể kết thúc giveaway.",
          ephemeral: true
        });
      }

      await endGiveaway(
        client,
        messageId
      );

      return interaction.reply({
        content:
          "✅ Đã kết thúc giveaway.",
        ephemeral: true
      });
    }

    // =================================================
    // REROLL
    // =================================================

    if (
      subcommand === "reroll"
    ) {
      const messageId =
        interaction.options.getString(
          "message_id"
        );

      const giveaway =
        getGiveaway(
          messageId
        );

      if (!giveaway) {
        return interaction.reply({
          content:
            "❌ Không tìm thấy giveaway.",
          ephemeral: true
        });
      }

      if (
        !giveaway.ended
      ) {
        return interaction.reply({
          content:
            "⚠️ Giveaway chưa kết thúc. Hãy dùng `/giveaway end` trước.",
          ephemeral: true
        });
      }

      const canManage =
        interaction.memberPermissions.has(
          PermissionFlagsBits.ManageGuild
        );

      const isHost =
        giveaway.hostId ===
        interaction.user.id;

      if (
        !canManage &&
        !isHost
      ) {
        return interaction.reply({
          content:
            "❌ Chỉ Host hoặc người có quyền **Manage Server** mới có thể reroll.",
          ephemeral: true
        });
      }

      try {
        const channel =
          await client.channels.fetch(
            giveaway.channelId
          );

        const message =
          await channel.messages.fetch(
            messageId
          );

        const participants =
          await getParticipants(
            message
          );

        const previousWinners =
          giveaway.winnerIds || [];

        const winners =
          pickWinners(
            participants,
            giveaway.winnersCount,
            previousWinners
          );

        if (
          winners.length === 0
        ) {
          return interaction.reply({
            content:
              "❌ Không còn người tham gia hợp lệ để reroll mà không trùng người thắng cũ.",
            ephemeral: true
          });
        }

        giveaway.winnerIds =
          winners;

        giveaway.rerolledAt =
          Date.now();

        setGiveaway(
          messageId,
          giveaway
        );

        const winnerMentions =
          winners
            .map(
              id => `<@${id}>`
            )
            .join(", ");

        await channel.send({
          content:
            `🔄 **REROLL GIVEAWAY!**\n` +
            `🎁 Phần thưởng: **${giveaway.prize}**\n` +
            `🎉 Người thắng mới: ${winnerMentions}`
        });

        return interaction.reply({
          content:
            "✅ Reroll thành công.",
          ephemeral: true
        });
      } catch (error) {
        console.error(
          "❌ Giveaway reroll error:",
          error
        );

        return interaction.reply({
          content:
            "❌ Không thể reroll. Có thể tin nhắn giveaway đã bị xóa.",
          ephemeral: true
        });
      }
    }

    // =================================================
    // LIST
    // =================================================

    if (
      subcommand === "list"
    ) {
      const giveaways =
        loadGiveaways();

      const active =
        Object.entries(
          giveaways
        ).filter(
          ([, giveaway]) =>
            giveaway &&
            !giveaway.ended
        );

      if (
        active.length === 0
      ) {
        return interaction.reply({
          content:
            "📭 Hiện không có giveaway nào đang chạy.",
          ephemeral: true
        });
      }

      const lines =
        active.map(
          ([messageId, giveaway]) =>
            `🎁 **${giveaway.prize}**\n` +
            `> Kết thúc: <t:${Math.floor(
              giveaway.endTime / 1000
            )}:R>\n` +
            `> Kênh: <#${giveaway.channelId}>\n` +
            `> ID: \`${messageId}\``
        );

      const embed =
        new EmbedBuilder()
          .setTitle(
            "📋 Giveaway đang chạy"
          )
          .setDescription(
            lines.join(
              "\n\n"
            )
          )
          .setColor(
            "#5865F2"
          )
          .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }
};