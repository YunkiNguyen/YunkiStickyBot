/**
 * Trạng thái HTTP cho `/` và `/healthz`.
 * 200 chỉ khi gateway Discord đã sẵn sàng. Trước đó hoặc khi mất kết nối: 503.
 */
export function describeHealth(discordReady) {
  if (discordReady) {
    return { statusCode: 200, body: "Yunki Bot is online" };
  }

  return { statusCode: 503, body: "Yunki Bot is not ready" };
}

/** Liveness: process còn sống, không nói gì về Discord. */
export function describeLiveness() {
  return { statusCode: 200, body: "Yunki Bot process is up" };
}
