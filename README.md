# Yunki Bot — Replit

Phiên bản `2.2.0`. Bot Discord (slash commands, moderation, giveaway, voice).

## 1. Cấu trúc

```text
YunkiBot/
├─ commands/
│  ├─ moderation/
│  │  ├─ ban.js unban.js kick.js timeout.js untimeout.js
│  │  ├─ warn.js unwarn.js warnings.js
│  │  └─ clear.js lock.js unlock.js slowmode.js
│  └─ utility/
│     ├─ giveaway.js join.js leave.js
│     ├─ ping.js status.js config.js help.js
│     ├─ userinfo.js serverinfo.js shutdown.js
├─ handlers/
│  └─ moderation.js
├─ utils/
│  ├─ giveawayService.js giveawayStore.js
│  ├─ warningsStore.js voiceStore.js voiceConnection.js
│  ├─ lockStore.js jsonStore.js duration.js health.js
│  └─ processLock.js
├─ config.js
├─ deploy-commands.js
├─ index.js
└─ package.json
```

## 2. Replit Secrets

- `DISCORD_TOKEN` — token bot. Không gửi cho người khác, không ghi vào `config.js`.
- `BOT_OWNER_ID` — user ID được dùng `/shutdown`. Không đặt thì lệnh bị khóa.
- `DATA_DIR` (nên đặt) — thư mục JSON bền. Mặc định `./data`.
- `CLIENT_ID` (tuỳ chọn) — ID application. Không đặt thì dùng `botId` trong `config.js`.
- `GUILD_ID` (tuỳ chọn) — **chỉ khi test 1 server**. Nếu đặt, lệnh chỉ hiện ở server đó.

Muốn bot dùng được ở **mọi server**: xóa `GUILD_ID` / `DISCORD_GUILD_ID` rồi chạy `npm run deploy`.
Lần đầu chuyển từ Guild sang Global, chạy một lần `CLEAR_GUILD_ID=<id server cũ> npm run deploy` để xóa lệnh cũ, tránh lệnh bị trùng.

## 3. Chạy

Cần Node.js `>= 22.12`.

```bash
npm install
npm run deploy
npm start
```

Sau khi kéo bản này, chạy lại `npm run deploy` để Discord nhận lệnh mới `/unwarn`.

## 4. Publish trên Replit

Bot phải **luôn online** và giữ file JSON. Trong Publishing chọn **Reserved VM**, không dùng Autoscale.

Autoscale ngủ khi không có request HTTP và có thể chạy nhiều bản — bot sẽ rớt gateway, mất giveaway / cảnh cáo / voice.

File `.replit` đã ghi `deploymentTarget = "vm"`. Nếu app đang publish kiểu Autoscale, vào **Publishing → Adjust settings** và đổi sang **Reserved VM**, rồi publish lại. Sửa file không tự đổi bản đang chạy.

Mỗi lần publish lại, đĩa của deployment có thể bị thay. Hãy trỏ `DATA_DIR` tới chỗ lưu bền nếu Replit có volume. Khi bot khởi động mà thiếu `DATA_DIR`, log sẽ cảnh báo.

### Health

| Đường dẫn | Ý nghĩa |
| --- | --- |
| `/` `/healthz` `/ready` | `200` chỉ khi Discord đã login. Đang khởi động hoặc mất kết nối: `503`. |
| `/live` | `200` khi process còn sống, kể cả lúc Discord chưa sẵn sàng. |

## 5. Quyền Discord

- Ban Members, Kick Members, Moderate Members
- Manage Messages, Manage Channels, Manage Roles (cho `/lock` `/unlock`)
- View Channels, Send Messages, Embed Links, Read Message History, Add Reactions
- Connect (voice)

Role của bot phải cao hơn member mà bot cần moderate.

## 6. Dữ liệu

`warnings.json`, `giveaways.json`, `voice.json`, `locks.json` nằm trong `DATA_DIR` và bị `.gitignore` loại. File JSON hỏng được đổi tên thành `<file>.corrupt-<thời gian>`, không bị ghi đè.

`/unwarn` gỡ cảnh cáo mới nhất (`count`, mặc định 1) hoặc toàn bộ (`all: true`).

Voice: `@discordjs/voice` 0.19 (có DAVE) và Node `>= 22.12`. Không nâng `sodium-native` lên bản 5 nếu voice đang chạy ổn — bản 4.3.x là bản đi cùng voice hiện tại.

Bot chỉ cần intent `Guilds` và `GuildVoiceStates`.

## 7. Tên hiển thị

Footer embed lấy từ `config.brand` (`Giáo Phái Phoebe`). Tên đầy đủ của server là `config.serverName` và hiện trong `/config`.
