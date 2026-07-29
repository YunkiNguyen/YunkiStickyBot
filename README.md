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

Tạo Secret:

- Key: `DISCORD_TOKEN`
- Value: Bot Token của bạn

**Không gửi Bot Token cho người khác và không đặt Token trong `config.js`.**

## 3. Điền ID

Mở `config.js` và thay:

- `botId`
- `guildId`
- `defaultChannelId`

`defaultChannelId` hiện chỉ để lưu cấu hình; các command không bắt buộc phải dùng nó.

## 4. Cài package

```bash
npm install
```

## 5. Đăng ký Slash Commands

```bash
npm run deploy
```

Nếu có `guildId`, command sẽ đăng ký riêng cho server và thường cập nhật nhanh hơn Global Commands.

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

Đây là bản rebuild sạch, không phụ thuộc `handlers/commandHandler.js` cũ.
