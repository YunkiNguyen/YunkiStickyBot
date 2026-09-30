import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState
} from "@discordjs/voice";
import { ChannelType } from "discord.js";
import { getVoiceChannel, removeVoiceChannel } from "./voiceStore.js";

// Tránh spam reconnect
const rejoinLocks = new Map();
const rejoinTimers = new Map();

function clearRejoinTimer(guildId) {
  const timer = rejoinTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    rejoinTimers.delete(guildId);
  }
}

/**
 * Gắn listener để reconnect nhanh khi connection bị rớt.
 * Chỉ reconnect nếu kênh vẫn còn trong voiceStore (chưa /leave).
 */
export function attachVoiceConnectionHandlers(connection, guildId, client) {
  // Tránh gắn trùng listener
  if (connection.__yunkiHandlersAttached) return;
  connection.__yunkiHandlersAttached = true;

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      // Thử recover nhanh trong 5s (Discord có thể chỉ lag tạm)
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
      ]);
      // Đã recover → không cần làm gì
      return;
    } catch {
      // Thật sự disconnect
      try {
        connection.destroy();
      } catch {}

      const savedChannelId = getVoiceChannel(guildId);
      if (!savedChannelId) {
        // Đã /leave → không reconnect
        return;
      }

      console.log(`VOICE DISCONNECTED: ${guildId} -> fast rejoin`);
      scheduleFastRejoin(guildId, client, 300);
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    const savedChannelId = getVoiceChannel(guildId);
    if (!savedChannelId) return;

    // Có thể do kick / network drop
    console.log(`VOICE DESTROYED: ${guildId} -> fast rejoin`);
    scheduleFastRejoin(guildId, client, 300);
  });

  connection.on("error", (error) => {
    console.error(`Voice connection error (${guildId}):`, error);
  });
}

export function scheduleFastRejoin(guildId, client, delayMs = 300) {
  clearRejoinTimer(guildId);

  const timer = setTimeout(async () => {
    rejoinTimers.delete(guildId);

    const savedChannelId = getVoiceChannel(guildId);
    if (!savedChannelId) return;

    await joinSavedVoiceChannel(client, guildId, savedChannelId, "FAST_REJOIN");
  }, delayMs);

  rejoinTimers.set(guildId, timer);
}

export async function joinSavedVoiceChannel(
  client,
  guildId,
  channelId,
  reason = "AUTO"
) {
  if (rejoinLocks.get(guildId)) {
    return false;
  }

  rejoinLocks.set(guildId, true);

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
    const permissions = channel.permissionsFor(me);

    if (!permissions?.has(["Connect", "ViewChannel"])) {
      console.log(`VOICE SKIP: Missing permissions in ${channel.name}`);
      return false;
    }

    // Đã ở đúng kênh + connection còn sống
    const existing = getVoiceConnection(guildId);
    if (
      me?.voice?.channelId === channel.id &&
      existing &&
      existing.state.status !== VoiceConnectionStatus.Destroyed &&
      existing.state.status !== VoiceConnectionStatus.Disconnected
    ) {
      attachVoiceConnectionHandlers(existing, guildId, client);
      return true;
    }

    if (existing) {
      try {
        existing.destroy();
      } catch {}
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    attachVoiceConnectionHandlers(connection, guildId, client);

    // Chờ sẵn sàng tối đa 10s
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    } catch {
      console.log(`VOICE NOT READY IN TIME: ${channel.name}`);
    }

    console.log(`${reason} JOIN VOICE: ${channel.name} (${guild.name})`);
    return true;
  } catch (error) {
    console.error(`FAILED TO JOIN VOICE: ${guildId}`, error);
    return false;
  } finally {
    rejoinLocks.set(guildId, false);
  }
}
