import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";

import {
  getGiveaway,
  setGiveaway,
  loadGiveaways
} from "../../utils/giveawayStore.js";


// =====================================================
// DUPLICATE INTERACTION PROTECTION
// =====================================================

const processedInteractions = new Set();

function markInteraction(id) {

  if (processedInteractions.has(id)) {
    return false;
  }

  processedInteractions.add(id);


  if (processedInteractions.size > 5000) {

    const first =
      processedInteractions.values()
      .next()
      .value;

    if (first) {
      processedInteractions.delete(first);
    }

  }


  return true;
}


// =====================================================
// DURATION PARSER
// =====================================================

function parseDuration(value) {

  if (!value) {
    return null;
  }


  const match =
    value.match(/^(\d+)(s|m|h|d)$/i);


  if (!match) {
    return null;
  }


  const amount =
    Number(match[1]);


  const unit =
    match[2].toLowerCase();


  const time = {

    s:1000,

    m:
      60 * 1000,

    h:
      60 *
      60 *
      1000,

    d:
      24 *
      60 *
      60 *
      1000

  };


  return amount * time[unit];

}


// =====================================================
// RANDOM WINNER
// =====================================================

function pickWinners(users, count) {


  const list =
    [...users];


  for (
    let i=list.length-1;
    i>0;
    i--
  ) {


    const j =
      Math.floor(
        Math.random()
        *
        (i+1)
      );


    [
      list[i],
      list[j]
    ] =
    [
      list[j],
      list[i]
    ];

  }


  return list.slice(
    0,
    Math.min(
      count,
      list.length
    )
  );

}


// =====================================================
// END GIVEAWAY
// =====================================================

export async function endGiveaway(
  client,
  messageId
) {


  const giveaway =
    getGiveaway(messageId);


  if (
    !giveaway ||
    giveaway.ended === true
  ) {

    return;

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

      console.error(
        "INVALID GIVEAWAY CHANNEL:",
        giveaway.channelId
      );

      return;

    }



    const message =
      await channel.messages.fetch(
        messageId
      );



    const reaction =
      message.reactions.cache.get(
        "🎉"
      );



    let users=[];



    if (reaction) {


      const fetched =
        await reaction.users.fetch();



      users =
        [
          ...fetched
          .filter(
            user =>
            !user.bot
          )
          .keys()
        ];

    }



    let winners=[];


    let description;



    if (users.length===0) {


      description =
        "😢 Không có ai tham gia Giveaway.";


    } else {


      winners =
        pickWinners(
          users,
          giveaway.winnersCount
        );


      description =
        `🎉 **Người thắng:** ${
          winners
          .map(
            id=>`<@${id}>`
          )
          .join(", ")
        }\n\n`+
        `🎁 **Phần thưởng:** ${
          giveaway.prize
        }`;

    }



    const embed =
      EmbedBuilder.from(
        message.embeds[0] || {}
      )
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
      embeds:[
        embed
      ]
    });



    if (winners.length>0) {


      await channel.send({

        content:
          `🎊 Chúc mừng ${
            winners
            .map(
              id=>`<@${id}>`
            )
            .join(", ")
          } đã thắng **${
            giveaway.prize
          }**!`

      });


    }



    giveaway.ended=true;

    giveaway.winnerIds=winners;

    giveaway.endedAt=
      Date.now();


    setGiveaway(
      messageId,
      giveaway
    );



    console.log(
      `GIVEAWAY ENDED: ${messageId}`
    );


  } catch(error) {


    console.error(
      "END GIVEAWAY ERROR:",
      messageId
    );


    console.error(error);

  }

}


export default {

data: new SlashCommandBuilder()

.setName("giveaway")

.setDescription(
  "Hệ thống Giveaway của Yunki Bot"
)

.setDefaultMemberPermissions(
  PermissionFlagsBits.ManageGuild
)


// =================================================
// START
// =================================================

.addSubcommand(sub =>
  sub

  .setName("start")

  .setDescription(
    "Tạo Giveaway mới"
  )


  .addStringOption(option =>
    option

    .setName("prize")

    .setDescription(
      "Phần thưởng Giveaway"
    )

    .setRequired(true)
  )


  .addStringOption(option =>
    option

    .setName("duration")

    .setDescription(
      "Ví dụ: 10m, 1h, 7d"
    )

    .setRequired(true)
  )


  .addIntegerOption(option =>
    option

    .setName("winners")

    .setDescription(
      "Số người thắng"
    )

    .setRequired(true)

    .setMinValue(1)

    .setMaxValue(20)
  )


  .addChannelOption(option =>
    option

    .setName("channel")

    .setDescription(
      "Kênh đăng Giveaway"
    )

    .setRequired(false)
  )

)



// =================================================
// END
// =================================================

.addSubcommand(sub =>

  sub

  .setName("end")

  .setDescription(
    "Kết thúc Giveaway"
  )


  .addStringOption(option =>

    option

    .setName("message_id")

    .setDescription(
      "ID message Giveaway"
    )

    .setRequired(true)

  )

)



// =================================================
// REROLL
// =================================================

.addSubcommand(sub =>

  sub

  .setName("reroll")

  .setDescription(
    "Chọn lại người thắng"
  )


  .addStringOption(option =>

    option

    .setName("message_id")

    .setDescription(
      "ID message Giveaway"
    )

    .setRequired(true)

  )

)


// =================================================
// LIST
// =================================================

.addSubcommand(sub =>

  sub

  .setName("list")

  .setDescription(
    "Xem Giveaway đang chạy"
  )

)



// =================================================
// RECOVER
// =================================================

.addSubcommand(sub =>

  sub

  .setName("recover")

  .setDescription(
    "Khôi phục Giveaway bị mất dữ liệu"
  )


  .addStringOption(option =>

    option

    .setName("message_id")

    .setDescription(
      "ID message Giveaway"
    )

    .setRequired(true)

  )

  .addStringOption(option =>

    option

    .setName("prize")

    .setDescription(
      "Phần thưởng (để trống sẽ tự lấy từ embed)"
    )

    .setRequired(false)

  )

  .addIntegerOption(option =>

    option

    .setName("winners")

    .setDescription(
      "Số người thắng (để trống sẽ tự lấy từ embed)"
    )

    .setRequired(false)

    .setMinValue(1)

    .setMaxValue(20)

  )

  .addStringOption(option =>

    option

    .setName("duration")

    .setDescription(
      "Thời gian còn lại (vd: 11d, 5h). Để trống sẽ cố lấy từ embed"
    )

    .setRequired(false)

  )
),

async execute(interaction, client) {


  if (!markInteraction(interaction.id)) {

    console.warn(
      "DUPLICATE GIVEAWAY INTERACTION:",
      interaction.id
    );

    return;

  }



  try {

    await interaction.deferReply({
      ephemeral:true
    });


  } catch(error) {

    console.error(
      "DEFER GIVEAWAY ERROR:",
      error
    );

    return;

  }



  try {


  const sub =
  interaction.options.getSubcommand();



  // =================================================
  // START
  // =================================================


  if(sub==="start"){


  const prize =
  interaction.options.getString(
    "prize"
  );


  const duration =
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
  )
  ||
  interaction.channel;



  if(
  !channel ||
  !channel.isTextBased()
  ){

  return interaction.editReply(
  {
  content:
  "❌ Kênh không hợp lệ."
  }
  );

  }



  const durationMs =
  parseDuration(duration);



  if(!durationMs){

  return interaction.editReply(
  {
  content:
  "❌ Thời gian không hợp lệ."
  }
  );

  }



  const endTime =
  Date.now()
  +
  durationMs;



  const embed =
  new EmbedBuilder()

  .setTitle(
  "🎉 GIVEAWAY"
  )

  .setDescription(

  `🎁 **Phần thưởng:** ${prize}\n`+

  `🏆 **Người thắng:** ${winnersCount}\n`+

  `⏰ **Kết thúc:** <t:${Math.floor(endTime/1000)}:R>\n\n`+

  "🎉 React 🎉 để tham gia!"

  )

  .setColor(
  "#5865F2"
  )

  .setTimestamp(
  endTime
  );



  const message =
  await channel.send({

  embeds:[
  embed
  ]

  });



  await message.react(
  "🎉"
  );



  setGiveaway(

  message.id,

  {

  messageId:
  message.id,

  prize,

  winnersCount,

  endTime,

  channelId:
  channel.id,

  guildId:
  interaction.guildId,

  hostId:
  interaction.user.id,

  ended:false

  }

  );



  return interaction.editReply({

  content:
  `✅ Đã tạo Giveaway tại ${channel}.`

  });


  }





  // =================================================
  // END
  // =================================================


  if(sub==="end"){


  const messageId =
  interaction.options.getString(
  "message_id"
  );



  const giveaway =
  getGiveaway(
  messageId
  );



  if(!giveaway){

  return interaction.editReply({

  content:
  "❌ Không tìm thấy Giveaway."

  });

  }



  await endGiveaway(
  client,
  messageId
  );



  return interaction.editReply({

  content:
  "✅ Đã kết thúc Giveaway."

  });


  }





  // =================================================
  // REROLL
  // =================================================


  if(sub==="reroll"){


  const messageId =
  interaction.options.getString(
  "message_id"
  );



  const giveaway =
  getGiveaway(
  messageId
  );



  if(!giveaway){

  return interaction.editReply({

  content:
  "❌ Không tìm thấy Giveaway."

  });

  }



  const channel =
  await client.channels.fetch(
  giveaway.channelId
  );



  const message =
  await channel.messages.fetch(
  messageId
  );



  const reaction =
  message.reactions.cache.get(
  "🎉"
  );



  if(!reaction){

  return interaction.editReply({

  content:
  "❌ Không có người tham gia."

  });

  }



  const users =
  [
  ...
  (
  await reaction.users.fetch()
  )

  .filter(
  u=>!u.bot
  )

  .keys()

  ];



  const winners =
  pickWinners(
  users,
  giveaway.winnersCount
  );



  await channel.send({

  content:

  `🎊 **Reroll!** Người thắng mới: `+

  winners
  .map(
  id=>`<@${id}>`
  )
  .join(", ")

  });



  return interaction.editReply({

  content:
  "✅ Reroll thành công."

  });


  }





  // =================================================
  // LIST
  // =================================================


  if(sub==="list"){


  const data =
  loadGiveaways();



  const active =
  Object.entries(data)
  .filter(
  ([,g])=>

  g &&
  !g.ended &&
  Number(g.endTime)>Date.now()

  );



  if(active.length===0){

  return interaction.editReply({

  content:
  "📭 Không có Giveaway đang chạy."

  });

  }



  let text="";



  for(
  const [id,g]
  of active
  ){

  text +=

  `🎁 **${g.prize}**\n`+

  `🏆 Người thắng: ${g.winnersCount}\n`+

  `⏰ <t:${Math.floor(g.endTime/1000)}:R>\n`+

  `🆔 \`${id}\`\n\n`;

  }



  return interaction.editReply({

  content:

  "📋 **GIVEAWAY ĐANG CHẠY**\n\n"

  +
  text

  });


  }




  // =================================================
  // RECOVER
  // =================================================


  if(sub==="recover"){


  const messageId =
  interaction.options.getString(
  "message_id"
  );

  const prizeOption =
  interaction.options.getString("prize");

  const winnersOption =
  interaction.options.getInteger("winners");

  const durationOption =
  interaction.options.getString("duration");



  try{


  // Thử fetch message từ channel hiện tại trước
  let message;
  try {
    message = await interaction.channel.messages.fetch(messageId);
  } catch {
    // Nếu không tìm thấy ở channel hiện tại thì báo lỗi rõ
    return interaction.editReply({
      content: "❌ Không tìm thấy message. Hãy chạy lệnh **trong đúng kênh** chứa Giveaway đó."
    });
  }



  const embed = message.embeds?.[0];
  const description = embed?.description || "";



  // =========================
  // PARSE PRIZE
  // =========================
  let prize = prizeOption;

  if (!prize) {
    // Thử nhiều pattern phổ biến
    const prizeMatch =
      description.match(/(?:Phần thưởng|Prize|🎁)\s*[:：*]+\s*(.+?)(?:\n|$)/i) ||
      description.match(/\*\*Phần thưởng:\*\*\s*(.+?)(?:\n|$)/i) ||
      description.match(/🎁\s*\*\*Phần thưởng:\*\*\s*(.+?)(?:\n|$)/i);

    prize = prizeMatch ? prizeMatch[1].trim() : "Recovered Giveaway";
  }



  // =========================
  // PARSE WINNERS COUNT
  // =========================
  let winnersCount = winnersOption;

  if (!winnersCount) {
    const winnersMatch =
      description.match(/(?:Số người thắng|Người thắng|Winners|🏆)\s*[:：*]+\s*(\d+)/i) ||
      description.match(/\*\*Người thắng:\*\*\s*(\d+)/i) ||
      description.match(/🏆\s*\*\*Người thắng:\*\*\s*(\d+)/i);

    winnersCount = winnersMatch ? Number(winnersMatch[1]) : 1;
  }



  // =========================
  // PARSE END TIME
  // =========================
  let endTime;

  // 1. Ưu tiên dùng duration người dùng nhập
  if (durationOption) {
    const durationMs = parseDuration(durationOption);
    if (!durationMs) {
      return interaction.editReply({
        content: "❌ Thời gian không hợp lệ. Ví dụ: `11d`, `5h`, `30m`"
      });
    }
    endTime = Date.now() + durationMs;
  }
  // 2. Thử lấy từ embed timestamp (nếu có)
  else if (embed?.timestamp) {
    endTime = new Date(embed.timestamp).getTime();
  }
  // 3. Thử parse relative time kiểu "11 ngày tới" hoặc timestamp Discord
  else {
    const relativeMatch = description.match(/(\d+)\s*(ngày|giờ|phút|d|h|m)\s*(tới|nữa)?/i);
    const timestampMatch = description.match(/<t:(\d+):[tTdDfFR]>/);

    if (timestampMatch) {
      endTime = Number(timestampMatch[1]) * 1000;
    } else if (relativeMatch) {
      const amount = Number(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      let ms = 0;

      if (unit.startsWith("ngày") || unit === "d") ms = amount * 24 * 60 * 60 * 1000;
      else if (unit.startsWith("giờ") || unit === "h") ms = amount * 60 * 60 * 1000;
      else if (unit.startsWith("phút") || unit === "m") ms = amount * 60 * 1000;

      endTime = Date.now() + ms;
    } else {
      // Fallback cuối cùng: 7 ngày
      endTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
    }
  }



  // =========================
  // LẤY PARTICIPANTS
  // =========================
  const reaction = message.reactions.cache.get("🎉");
  let participants = [];

  if (reaction) {
    const users = await reaction.users.fetch();
    participants = [...users.filter(u => !u.bot).keys()];
  }



  // =========================
  // LƯU DỮ LIỆU
  // =========================
  setGiveaway(messageId, {
    messageId,
    prize,
    winnersCount,
    endTime,
    channelId: message.channel.id,
    guildId: interaction.guildId,
    hostId: interaction.user.id,
    participants,
    participantCount: participants.length,
    ended: false,
    recoveredAt: Date.now()
  });



  return interaction.editReply({
    content:
      `✅ **Đã recover Giveaway thành công!**\n\n` +
      `🎁 Phần thưởng: **${prize}**\n` +
      `🏆 Số người thắng: **${winnersCount}**\n` +
      `⏰ Kết thúc: <t:${Math.floor(endTime / 1000)}:R>\n` +
      `👥 Người tham gia hiện tại: **${participants.length}**\n\n` +
      `⚠️ **Lưu ý:** Hãy **restart bot** một lần để timer kết thúc được schedule lại.`
  });



  } catch (error) {

    console.error("RECOVER ERROR:", error);

    return interaction.editReply({
      content: "❌ Recover thất bại. Kiểm tra lại message_id và xem bot có quyền đọc message không."
    });

  }


  }




  return interaction.editReply({

  content:
  "❌ Lệnh không hợp lệ."

  });



  }catch(error){


  console.error(
  "GIVEAWAY EXECUTE ERROR:",
  error
  );



  return interaction.editReply({

  content:
  "❌ Giveaway bị lỗi."

  });


  }


  }

};