import { EmbedBuilder } from "discord.js";
import {
  getGiveaway,
  setGiveaway,
  loadGiveaways
} from "./giveawayStore.js";

export const GIVEAWAY_EMOJI = "🎉";

const MAX_TIMEOUT = 2_147_483_647; // ~24,85 ngày - giới hạn của setTimeout
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 60_000;

// Unknown Channel / Unknown Guild / Unknown Message / Missing Access
const PERMANENT_ERROR_CODES = new Set([10003, 10004, 10008, 50001]);

const timers = new Map();
// Trạng thái "đang kết thúc" chỉ giữ trong RAM. Không ghi ra file để
// crash / restart giữa chừng không làm giveaway kẹt vĩnh viễn.
const endingNow = new Set();
const retryCounts = new Map();

function clearTimer(messageId) {
  const timer = timers.get(messageId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(messageId);
  }
}

/**
 * Lấy TOÀN BỘ người react 🎉 (phân trang, mỗi trang 100 người).
 */
export async function fetchReactionUserIds(message) {
  const reaction =
    message.reactions.cache.get(GIVEAWAY_EMOJI) ??
    message.reactions.resolve?.(GIVEAWAY_EMOJI);

  if (!reaction) return [];

  const ids = new Set();
  let after;

  for (let page = 0; page < 500; page++) {
    const batch = await reaction.users.fetch({ limit: 100, after });
    if (!batch || batch.size === 0) break;

    let maxId = null;
    for (const user of batch.values()) {
      if (!user.bot) ids.add(user.id);
      if (maxId === null || BigInt(user.id) > BigInt(maxId)) maxId = user.id;
    }

    if (batch.size < 100 || maxId === null) break;
    after = maxId;
  }

  return [...ids];
}

function shuffle(items) {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/**
 * Chọn người thắng ngẫu nhiên, bỏ qua người đã rời server và những ID trong `exclude`.
 */
export async function pickWinners(guild, userIds, count, exclude = []) {
  const excluded = new Set(exclude);
  const pool = shuffle(userIds.filter(id => !excluded.has(id)));
  const winners = [];

  for (const id of pool) {
    if (winners.length >= count) break;

    if (guild) {
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) continue;
    }

    winners.push(id);
  }

  return winners;
}

function finalizeGiveaway(messageId, giveaway, winners = [], note = null) {
  clearTimer(messageId);
  retryCounts.delete(messageId);

  const updated = {
    ...giveaway,
    ended: true,
    winnerIds: winners,
    endedAt: Date.now()
  };

  delete updated.ending; // cờ cũ từ phiên bản trước
  if (note) updated.endNote = note;

  setGiveaway(messageId, updated);
}

function mentionList(ids) {
  return ids.map(id => `<@${id}>`).join(", ");
}

/**
 * Kết thúc giveaway. Không ném lỗi; trả về { status }.
 * status: ended | not_found | already_ended | in_progress | not_due | retry | abandoned
 * force = true: bỏ qua kiểm tra endTime (dùng cho /giveaway end).
 */
export async function endGiveaway(client, messageId, { force = false } = {}) {
  const giveaway = getGiveaway(messageId);

  if (!giveaway) return { status: "not_found" };
  if (giveaway.ended === true) return { status: "already_ended" };
  if (endingNow.has(messageId)) return { status: "in_progress" };

  // Chặn timer chạy sớm (ví dụ setTimeout bị cắt ở 24,85 ngày).
  if (!force && Number(giveaway.endTime) > Date.now()) {
    return { status: "not_due" };
  }

  endingNow.add(messageId);

  try {
    const channel = await client.channels.fetch(giveaway.channelId);

    if (!channel || !channel.isTextBased()) {
      finalizeGiveaway(messageId, giveaway, [], "invalid_channel");
      return { status: "abandoned" };
    }

    if (giveaway.guildId && channel.guildId !== giveaway.guildId) {
      finalizeGiveaway(messageId, giveaway, [], "guild_mismatch");
      return { status: "abandoned" };
    }

    const message = await channel.messages.fetch(messageId);

    if (message.author?.id !== client.user.id) {
      console.error(`GIVEAWAY MESSAGE IS NOT FROM BOT: ${messageId}`);
      finalizeGiveaway(messageId, giveaway, [], "not_bot_message");
      return { status: "abandoned" };
    }

    const userIds = await fetchReactionUserIds(message);
    const winners = await pickWinners(
      channel.guild,
      userIds,
      Number(giveaway.winnersCount) || 1
    );

    const description = winners.length
      ? `🎉 **Người thắng:** ${mentionList(winners)}\n\n🎁 **Phần thưởng:** ${giveaway.prize}`
      : "😢 Không có ai tham gia Giveaway.";

    const endedEmbed = EmbedBuilder.from(message.embeds[0] ?? {})
      .setTitle("🎉 GIVEAWAY ĐÃ KẾT THÚC")
      .setDescription(description)
      .setColor("#57F287");

    await message.edit({ embeds: [endedEmbed] });

    if (winners.length > 0) {
      try {
        await channel.send({
          content: `🎊 Chúc mừng ${mentionList(winners)} đã thắng **${giveaway.prize}**!`,
          allowedMentions: { users: winners }
        });
      } catch (error) {
        console.error(`FAILED TO ANNOUNCE GIVEAWAY WINNERS: ${messageId}`, error);
      }
    }

    finalizeGiveaway(messageId, giveaway, winners);
    console.log(`GIVEAWAY ENDED: ${messageId}`);

    return { status: "ended", winners };
  } catch (error) {
    if (PERMANENT_ERROR_CODES.has(error?.code)) {
      console.log(
        `GIVEAWAY CLOSED (discord error ${error.code}): ${messageId}`
      );
      finalizeGiveaway(messageId, giveaway, [], `error:${error.code}`);
      return { status: "abandoned" };
    }

    console.error(`END GIVEAWAY ERROR: ${messageId}`);
    console.error(error);
    scheduleRetry(client, messageId);

    return { status: "retry" };
  } finally {
    endingNow.delete(messageId);
  }
}

function scheduleRetry(client, messageId) {
  const attempts = (retryCounts.get(messageId) ?? 0) + 1;
  retryCounts.set(messageId, attempts);

  if (attempts > MAX_RETRIES) {
    console.error(
      `GIVEAWAY ${messageId}: quá ${MAX_RETRIES} lần thử lại, sẽ thử lại khi bot khởi động lần sau.`
    );
    return;
  }

  clearTimer(messageId);

  const timer = setTimeout(() => {
    timers.delete(messageId);
    endGiveaway(client, messageId).catch(error => {
      console.error(`RETRY END GIVEAWAY FAILED: ${messageId}`, error);
    });
  }, RETRY_DELAY_MS);

  timers.set(messageId, timer);
}

/**
 * Lên lịch kết thúc giveaway; xử lý được thời gian > 24,85 ngày.
 * Nếu đã quá hạn thì kết thúc ngay.
 */
export async function scheduleGiveaway(client, messageId, endTime) {
  clearTimer(messageId);

  const remaining = Number(endTime) - Date.now();
  if (!Number.isFinite(remaining)) return;

  if (remaining <= 0) {
    await endGiveaway(client, messageId);
    return;
  }

  const timer = setTimeout(() => {
    timers.delete(messageId);
    scheduleGiveaway(client, messageId, endTime).catch(error => {
      console.error(`SCHEDULE GIVEAWAY ERROR: ${messageId}`, error);
    });
  }, Math.min(remaining, MAX_TIMEOUT));

  timers.set(messageId, timer);
  console.log(
    `SCHEDULED GIVEAWAY: ${messageId} | ${Math.ceil(remaining / 1000)}s remaining`
  );
}

export async function resumeGiveaways(client) {
  try {
    const entries = Object.entries(loadGiveaways());
    console.log(`CHECKING GIVEAWAYS: ${entries.length}`);

    for (const [messageId, giveaway] of entries) {
      if (!giveaway || giveaway.ended === true) continue;

      try {
        await scheduleGiveaway(client, messageId, giveaway.endTime);
      } catch (error) {
        console.error(`FAILED TO RESUME GIVEAWAY: ${messageId}`, error);
      }
    }
  } catch (error) {
    console.error("FAILED TO RESUME GIVEAWAYS", error);
  }
}

/**
 * Reroll: chọn người thắng MỚI, loại trừ người đã thắng trước đó.
 */
export async function rerollGiveaway(client, messageId, count = 1) {
  const giveaway = getGiveaway(messageId);

  if (!giveaway) return { status: "not_found" };
  if (giveaway.ended !== true) return { status: "not_ended" };

  let channel;
  let message;

  try {
    channel = await client.channels.fetch(giveaway.channelId);
    if (!channel || !channel.isTextBased()) return { status: "channel_missing" };

    message = await channel.messages.fetch(messageId);
  } catch (error) {
    if (PERMANENT_ERROR_CODES.has(error?.code)) {
      return { status: "message_missing" };
    }
    throw error;
  }

  const userIds = await fetchReactionUserIds(message);
  const exclude = [
    ...(giveaway.winnerIds ?? []),
    ...(giveaway.rerollWinnerIds ?? [])
  ];

  const winners = await pickWinners(channel.guild, userIds, count, exclude);
  if (winners.length === 0) return { status: "no_candidates" };

  await channel.send({
    content: `🎊 **Reroll!** Người thắng mới của **${giveaway.prize}** là: ${mentionList(winners)}`,
    allowedMentions: { users: winners }
  });

  setGiveaway(messageId, {
    ...giveaway,
    rerollWinnerIds: [...(giveaway.rerollWinnerIds ?? []), ...winners]
  });

  return { status: "ok", winners };
}
