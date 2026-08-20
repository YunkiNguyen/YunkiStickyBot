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
- Key: `GUILD_ID` — ID server Discord dùng để đăng ký Guild Commands

**Không gửi Bot Token cho người khác và không đặt Token trong `config.js`.**

`DISCORD_GUILD_ID` cũng được hỗ trợ như tên thay thế cho `GUILD_ID`.

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
- View Channels
- Send Messages
- Embed Links
- Read Message History

Ngoài permission, role của bot phải nằm **cao hơn các member mà bot cần moderate**.

## Lưu ý

Warning được lưu trong `data/warnings.json` để không mất dữ liệu khi bot restart. File runtime JSON vẫn được giữ ngoài Git bởi `.gitignore`.

Giveaway cũng lưu dữ liệu trong `data/giveaways.json` và store đã có xử lý file JSON lỗi/corrupt an toàn hơn.

Đây là bản rebuild sạch, không phụ thuộc `handlers/commandHandler.js` cũ.
