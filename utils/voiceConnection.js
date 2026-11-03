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
const READY_TIMEOUT_MS = 15_000;

const rejoinLocks = new Set();
const rejoinTimers = new Map();
const rejoinAttempts = new Map();
const stableTimers = new Map();

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

/** Huỷ mọi lịch rejoin của guild (dùng khi /leave). */
export function cancelRejoin(guildId) {
  clearRejoinTimer(guildId);
  clearStableTimer(guildId);
  rejoinAttempts.delete(guildId);
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
    clearStableTimer(guildId);

    try {
      // Thử recover nhanh trong 5s (Discord có thể chỉ lag tạm / bot bị chuyển kênh)
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
      ]);
      return;
    } catch {
      destroyConnectionQuietly(connection);

      if (!getVoiceChannel(guildId)) return; // đã /leave

      console.log(`VOICE DISCONNECTED: ${guildId} -> rejoin`);
      scheduleFastRejoin(guildId, client);
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    clearStableTimer(guildId);

    if (connection.__yunkiQuietDestroy) return;
    if (!getVoiceChannel(guildId)) return;

    console.log(`VOICE DESTROYED: ${guildId} -> rejoin`);
    scheduleFastRejoin(guildId, client);
  });

  connection.on("error", (error) => {
    console.error(`Voice connection error (${guildId}):`, error);
  });
}

export function scheduleFastRejoin(guildId, client, delayMs = nextDelay(guildId)) {
  clearRejoinTimer(guildId);

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

    // Đã có connection còn sống tới đúng kênh -> giữ nguyên.
    const existing = getVoiceConnection(guildId);
    const aliveStatuses = [
      VoiceConnectionStatus.Signalling,
      VoiceConnectionStatus.Connecting,
      VoiceConnectionStatus.Ready
    ];

    if (
      existing &&
      existing.joinConfig?.channelId === channel.id &&
      aliveStatuses.includes(existing.state.status)
    ) {
      attachVoiceConnectionHandlers(existing, guildId, client);
      return true;
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
        `VOICE NOT READY IN TIME: ${channel.name} (${guild.name}) -> sẽ thử lại với backoff`
      );

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
