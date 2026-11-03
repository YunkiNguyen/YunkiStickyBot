# Yunki Bot — Replit

## 1. Cấu trúc

```text
YunkiBot/
├─ commands/
│  ├─ moderation/
│  │  ├─ ban.js
│  │  ├─ clear.js
│  │  ├─ kick.js
│  │  ├─ lock.js
│  │  ├─ slowmode.js
│  │  ├─ timeout.js
│  │  ├─ unban.js
│  │  ├─ unlock.js
│  │  ├─ untimeout.js
│  │  ├─ warn.js
│  │  └─ warnings.js
│  └─ utility/
│     ├─ config.js
│     ├─ help.js
│     ├─ ping.js
│     ├─ serverinfo.js
│     ├─ status.js
│     └─ userinfo.js
├─ handlers/
│  └─ moderation.js
├─ data/
│  └─ warnings.json
├─ config.js
├─ deploy-commands.js
├─ index.js
└─ package.json
```

## 2. Replit Secrets

Tạo các Secret:

- Key: `DISCORD_TOKEN` — Bot Token của bạn
- Key: `BOT_OWNER_ID` — User ID được phép dùng `/shutdown` (không đặt = lệnh bị khóa)
- Key (tuỳ chọn): `DATA_DIR` — thư mục lưu dữ liệu bền vững (mặc định `./data`)
- Key (tuỳ chọn): `GUILD_ID` — **chỉ dùng khi test 1 server**. Nếu đặt, lệnh chỉ xuất hiện ở server đó.

**Không gửi Bot Token cho người khác và không đặt Token trong `config.js`.**

Muốn bot dùng được ở **mọi server**: **xóa** `GUILD_ID` / `DISCORD_GUILD_ID` khỏi Secrets rồi chạy `npm run deploy` (đăng ký Global Commands).
Lần đầu chuyển từ Guild sang Global, chạy một lần với `CLEAR_GUILD_ID=<id server cũ> npm run deploy` để xóa lệnh cũ, tránh lệnh bị hiện trùng.

## 3. Điền ID

`config.js` lấy các giá trị sau:

- `botId` — ID bot
- `GUILD_ID` / `DISCORD_GUILD_ID` — ID server
- `defaultChannelId` — kênh mặc định nếu command cần dùng

`defaultChannelId` hiện chỉ để lưu cấu hình; các command không bắt buộc phải dùng nó.

## 4. Cài package

```bash
npm install
```

## 5. Đăng ký Slash Commands

```bash
npm run deploy
```

Khi có `GUILD_ID`, command sẽ được đăng ký riêng cho server và thường cập nhật nhanh hơn Global Commands.

## 6. Chạy bot

```bash
npm start
```

## 7. Quyền Discord

Bot cần tối thiểu các quyền phù hợp với command:

- Ban Members
- Kick Members
- Moderate Members
- Manage Messages
- Manage Channels
- Manage Roles (Manage Permissions) — cần cho `/lock` và `/unlock`
- View Channels
- Send Messages
- Embed Links
- Read Message History

Ngoài permission, role của bot phải nằm **cao hơn các member mà bot cần moderate**.

## Lưu ý

Dữ liệu runtime (`warnings.json`, `giveaways.json`, `voice.json`, `locks.json`) nằm trong `DATA_DIR` (mặc định `./data`) và được giữ ngoài Git bởi `.gitignore`.
**Hãy deploy bằng Reserved VM** (không dùng Autoscale) và để `DATA_DIR` trỏ tới nơi lưu trữ bền vững; nếu không, dữ liệu có thể mất khi redeploy.

Nếu một file JSON bị hỏng, bot **không ghi đè**: file được đổi tên thành `<file>.corrupt-<thời gian>` để bạn có thể khôi phục thủ công.

Voice: `@discordjs/voice` ≥ 0.19 (có DAVE) và Node.js ≥ 22.12 là bắt buộc để bot treo được trong voice channel thường (Discord yêu cầu DAVE từ 03/2026).

Bot chỉ cần intent `Guilds` và `GuildVoiceStates` (không cần Message Content).
