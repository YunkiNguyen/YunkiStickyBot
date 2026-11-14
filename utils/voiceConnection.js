import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState
} from "@discordjs/voice";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { getVoiceChannel, removeVoiceChannel } from "./voiceStore.js";

const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 60_000;
const STABLE_AFTER_MS = 60_000;
const READY_TIMEOUT_MS = 12_000;
const SOFT_REJOIN_TIMEOUT_MS = 8_000;

const rejoinLocks = new Set();
const rejoinTimers = new Map();
const rejoinAttempts = new Map();
const stableTimers = new Map();
const recovering = new Set();

// Backoff: 300ms, 600ms, 1.2s ... tối đa 60s. Chỉ reset khi kết nối ổn định 60s.
function nextDelay(guildId) {
  const attempts = rejoinAttempts.get(guildId) ?? 0;
  return Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
}

function clearRejoinTimer(guildId) {
  const timer = rejoinTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    rejoinTimers.delete(guildId);
  }
}

function clearStableTimer(guildId) {
  const timer = stableTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    stableTimers.delete(guildId);
  }
}

/** Đang soft-rejoin hoặc đã có lịch join — đừng tạo thêm một lần nữa. */
export function isVoiceRecovering(guildId) {
  return (
    recovering.has(guildId) ||
    rejoinLocks.has(guildId) ||
    rejoinTimers.has(guildId)
  );
}

/** Huỷ mọi lịch rejoin của guild (dùng khi /leave). */
export function cancelRejoin(guildId) {
  clearRejoinTimer(guildId);
  clearStableTimer(guildId);
  rejoinAttempts.delete(guildId);
  recovering.delete(guildId);
}

/**
 * Huỷ connection mà KHÔNG kích hoạt auto-rejoin
 * (listener "Destroyed" sẽ bỏ qua connection đã đánh dấu).
 */
export function destroyConnectionQuietly(connection) {
  if (!connection) return;

  connection.__yunkiQuietDestroy = true;

  try {
    connection.destroy();
  } catch {
    // đã bị destroy trước đó
  }
}

/**
 * Nối lại đúng phiên voice cũ (không gửi leave).
 * destroy() mới là lúc Discord ghi nhận bot rời kênh và reset thời gian phòng.
 */
async function trySoftRejoin(connection, guildId) {
  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    return false;
  }

  if (connection.state.status === VoiceConnectionStatus.Ready) {
    return true;
  }

  recovering.add(guildId);

  try {
    if (connection.state.status === VoiceConnectionStatus.Disconnected) {
      connection.rejoin();
    }

    await entersState(connection, VoiceConnectionStatus.Ready, SOFT_REJOIN_TIMEOUT_MS);
    console.log(`VOICE SOFT REJOIN OK: ${guildId}`);
    return true;
  } catch {
    console.log(`VOICE SOFT REJOIN FAILED: ${guildId}`);
    return false;
  } finally {
    recovering.delete(guildId);
  }
}

/**
 * Gắn listener để reconnect khi connection bị rớt.
 * Chỉ reconnect nếu kênh vẫn còn trong voiceStore (chưa /leave).
 */
export function attachVoiceConnectionHandlers(connection, guildId, client) {
  if (connection.__yunkiHandlersAttached) return;
  connection.__yunkiHandlersAttached = true;

  connection.on(VoiceConnectionStatus.Ready, () => {
    clearStableTimer(guildId);

    stableTimers.set(
      guildId,
      setTimeout(() => {
        stableTimers.delete(guildId);
        rejoinAttempts.delete(guildId);
      }, STABLE_AFTER_MS)
    );
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    if (connection.__yunkiQuietDestroy) return;
    if (recovering.has(guildId)) return;

    clearStableTimer(guildId);

    try {
      // Lag ngắn / bị chuyển kênh: Discord tự nối lại, không đụng vào.
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 2_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 2_000),
        entersState(connection, VoiceConnectionStatus.Ready, 2_000)
      ]);
      return;
    } catch {
      // vẫn Disconnected
    }

    if (!getVoiceChannel(guildId)) return;

    const recovered = await trySoftRejoin(connection, guildId);
    if (recovered) return;

    if (connection.state.status === VoiceConnectionStatus.Destroyed) {
      scheduleFastRejoin(guildId, client);
      return;
    }

    console.log(`VOICE DISCONNECTED: ${guildId} -> hard rejoin`);
    destroyConnectionQuietly(connection);
    scheduleFastRejoin(guildId, client);
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    clearStableTimer(guildId);

    if (connection.__yunkiQuietDestroy) return;
    if (!getVoiceChannel(guildId)) return;
    if (isVoiceRecovering(guildId)) return;

    console.log(`VOICE DESTROYED: ${guildId} -> rejoin`);
    scheduleFastRejoin(guildId, client);
  });

  connection.on("error", (error) => {
    console.error(`Voice connection error (${guildId}):`, error);
  });
}

export function scheduleFastRejoin(guildId, client, delayMs = nextDelay(guildId)) {
  // Giữ timer đầu tiên. Event thứ hai (VoiceState + Disconnected) không được reset.
  if (rejoinTimers.has(guildId) || recovering.has(guildId)) return;

  const timer = setTimeout(async () => {
    rejoinTimers.delete(guildId);

    const savedChannelId = getVoiceChannel(guildId);
    if (!savedChannelId) return;

    rejoinAttempts.set(guildId, (rejoinAttempts.get(guildId) ?? 0) + 1);

    try {
      await joinSavedVoiceChannel(client, guildId, savedChannelId, "REJOIN");
    } catch (error) {
      console.error(`REJOIN ERROR: ${guildId}`, error);
    }
  }, delayMs);

  rejoinTimers.set(guildId, timer);
}

export async function joinSavedVoiceChannel(
  client,
  guildId,
  channelId,
  reason = "AUTO"
) {
  if (rejoinLocks.has(guildId)) {
    return false;
  }

  rejoinLocks.add(guildId);

  try {
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      console.log(`VOICE SKIP: Guild ${guildId} not found`);
      removeVoiceChannel(guildId);
      return false;
    }

    const channel = guild.channels.cache.get(channelId);

    if (
      !channel ||
      (channel.type !== ChannelType.GuildVoice &&
        channel.type !== ChannelType.GuildStageVoice)
    ) {
      console.log(`VOICE SKIP: Channel ${channelId} invalid`);
      removeVoiceChannel(guildId);
      return false;
    }

    const me = guild.members.me;
    const permissions = me ? channel.permissionsFor(me) : null;

    if (
      !permissions?.has([
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.ViewChannel
      ])
    ) {
      console.log(`VOICE SKIP: Missing permissions in ${channel.name}`);
      return false;
    }

    const existing = getVoiceConnection(guildId);
    const aliveStatuses = [
      VoiceConnectionStatus.Signalling,
      VoiceConnectionStatus.Connecting,
      VoiceConnectionStatus.Ready
    ];

    if (existing && existing.joinConfig?.channelId === channel.id) {
      if (aliveStatuses.includes(existing.state.status)) {
        attachVoiceConnectionHandlers(existing, guildId, client);
        return true;
      }

      if (existing.state.status === VoiceConnectionStatus.Disconnected) {
        const recovered = await trySoftRejoin(existing, guildId);
        if (recovered) {
          attachVoiceConnectionHandlers(existing, guildId, client);
          console.log(`${reason} JOIN VOICE: ${channel.name} (${guild.name})`);
          return true;
        }
      }
    }

    if (existing) destroyConnectionQuietly(existing);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    attachVoiceConnectionHandlers(connection, guildId, client);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, READY_TIMEOUT_MS);
    } catch {
      console.log(
        `VOICE NOT READY IN TIME: ${channel.name} (${guild.name}) -> soft rejoin`
      );

      const recovered = await trySoftRejoin(connection, guildId);
      if (recovered) {
        console.log(`${reason} JOIN VOICE: ${channel.name} (${guild.name})`);
        return true;
      }

      destroyConnectionQuietly(connection);

      if (getVoiceChannel(guildId)) {
        scheduleFastRejoin(guildId, client);
      }

      return false;
    }

    console.log(`${reason} JOIN VOICE: ${channel.name} (${guild.name})`);
    return true;
  } catch (error) {
    console.error(`FAILED TO JOIN VOICE: ${guildId}`, error);
    return false;
  } finally {
    rejoinLocks.delete(guildId);
  }
}
