// index.js — NedeerVilleBOT, file utama
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

const config = require('./config.json');
const db = require('./database');
const youtube = require('./youtube');

require('dns').setDefaultResultOrder('ipv4first'); // fix ENOTFOUND di beberapa hosting

const allCommands = [
  ...require('./commands/moderation'),
  ...require('./commands/member'),
  ...require('./commands/server'),
  ...require('./commands/engagement'),
  ...require('./commands/ticket'),
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ============================================================
// FITUR: RANDOM PFP (dari fitur sebelumnya)
// ============================================================
async function getRandomImageUrl() {
  const categories = ['anime', 'cat', 'aesthetic'];
  const category = categories[Math.floor(Math.random() * categories.length)];
  try {
    if (category === 'anime') {
      const endpoints = ['waifu', 'neko', 'megumin', 'shinobu', 'smile', 'blush'];
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const res = await fetch(`https://api.waifu.pics/sfw/${ep}`);
      const data = await res.json();
      return data.url;
    }
    if (category === 'cat') {
      const res = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await res.json();
      return data[0].url;
    }
    const seed = Math.floor(Math.random() * 100000);
    const grayscale = Math.random() < 0.5 ? '?grayscale' : '';
    return `https://picsum.photos/seed/${seed}/500/500${grayscale}`;
  } catch (err) {
    const seed = Math.floor(Math.random() * 100000);
    return `https://picsum.photos/seed/${seed}/500/500`;
  }
}
async function sendDailyPfps() {
  try {
    const channelId = process.env.TARGET_CHANNEL_ID;
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId);
    const urls = [];
    for (let i = 0; i < 5; i++) urls.push(await getRandomImageUrl());
    const embeds = urls.map((url, i) =>
      new EmbedBuilder().setTitle(`Random PFP #${i + 1}`).setImage(url).setColor(0x2b2d31)
    );
    await channel.send({ content: '✨ **Random PFP hari ini!**', embeds });
  } catch (err) {
    console.error('Gagal mengirim pfp:', err.message);
  }
}

// ============================================================
// FITUR: AUTO-MODERATION (anti-spam, anti-link, word filter)
// ============================================================
const INVITE_REGEX = /(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/\S+/i;
const LINK_REGEX = /https?:\/\/\S+/i;
const spamTracker = new Map();

async function logModerationAction(guild, embed) {
  const id = process.env.LOG_CHANNEL_ID;
  if (!id) return;
  try {
    const ch = await guild.channels.fetch(id);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (err) {
    console.warn('Gagal kirim log:', err.message);
  }
}

function isSpamming(userId) {
  const now = Date.now();
  const timestamps = (spamTracker.get(userId) || []).filter((t) => now - t < config.antiSpam.timeWindowMs);
  timestamps.push(now);
  spamTracker.set(userId, timestamps);
  return timestamps.length > config.antiSpam.maxMessages;
}

async function handleAutoModeration(message) {
  if (message.author.bot || !message.guild) return false;
  if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  if (INVITE_REGEX.test(message.content) || LINK_REGEX.test(message.content)) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send(`🔗 <@${message.author.id}>, link/invite tidak diperbolehkan di sini.`);
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return true;
  }

  const lower = message.content.toLowerCase();
  if (config.wordFilter.some((w) => lower.includes(w.toLowerCase()))) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send(`🤬 <@${message.author.id}>, kata-kata itu tidak diperbolehkan di sini.`);
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return true;
  }

  if (isSpamming(message.author.id)) {
    try {
      await message.member.timeout(config.antiSpam.timeoutMinutes * 60 * 1000, 'Terdeteksi spam pesan');
      const embed = new EmbedBuilder()
        .setTitle('🚫 Anti-spam terpicu')
        .setColor(0xe67e22)
        .setDescription(`<@${message.author.id}> di-timeout ${config.antiSpam.timeoutMinutes} menit karena spam.`)
        .setTimestamp();
      await message.channel.send({ embeds: [embed] });
      await logModerationAction(message.guild, embed);
      spamTracker.delete(message.author.id);
    } catch (err) {
      console.warn('Gagal auto-timeout spam:', err.message);
    }
    return true;
  }
  return false;
}

// ============================================================
// FITUR: LEVELING (XP per pesan)
// ============================================================
const xpCooldown = new Map();

async function handleLeveling(message) {
  if (message.author.bot || !message.guild) return;
  const now = Date.now();
  const last = xpCooldown.get(message.author.id) || 0;
  if (now - last < config.leveling.xpCooldownSeconds * 1000) return;
  xpCooldown.set(message.author.id, now);

  const result = db.addXp(message.guildId, message.author.id, config.leveling.xpPerMessage, config.leveling.xpBaseForLevelUp);
  if (result.leveledUp) {
    const channelId = process.env.LEVELUP_CHANNEL_ID || message.channelId;
    try {
      const channel = await client.channels.fetch(channelId);
      const embed = new EmbedBuilder()
        .setDescription(`🎉 Selamat <@${message.author.id}>, kamu naik ke **Level ${result.newLevel}**!`)
        .setColor(0x2ecc71);
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.warn('Gagal kirim level-up:', err.message);
    }
  }
}

// ============================================================
// FITUR: TICKET SYSTEM
// ============================================================
const TICKET_LABELS = {
  ticket_support: { name: 'Support', emoji: '🛠️' },
  ticket_report: { name: 'Report Member', emoji: '🚨' },
  ticket_partnership: { name: 'Partnership', emoji: '🤝' },
  ticket_question: { name: 'Question', emoji: '❓' },
};

async function handleTicketCreate(interaction, type) {
  const info = TICKET_LABELS[type];
  const guild = interaction.guild;
  const categoryId = process.env.TICKET_CATEGORY_ID;
  const staffRoleId = process.env.TICKET_STAFF_ROLE_ID;

  const overwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  ];
  if (staffRoleId) {
    overwrites.push({ id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  }

  const channel = await guild.channels.create({
    name: `ticket-${info.name.toLowerCase().replace(/\s+/g, '-')}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    permissionOverwrites: overwrites,
  });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Tutup Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setTitle(`${info.emoji} Ticket: ${info.name}`)
    .setDescription(`Halo <@${interaction.user.id}>, staff akan segera membantu kamu. Jelaskan kebutuhanmu di sini.`)
    .setColor(0x5865f2);

  await channel.send({
    content: staffRoleId ? `<@&${staffRoleId}>` : undefined,
    embeds: [embed],
    components: [closeRow],
  });

  await interaction.reply({ content: `✅ Ticket kamu dibuat: <#${channel.id}>`, ephemeral: true });
}

async function handleTicketClose(interaction) {
  await interaction.reply('🔒 Ticket akan ditutup dalam 5 detik...');

  // Buat transcript sederhana (teks) sebelum channel dihapus
  const logChannelId = process.env.TICKET_LOG_CHANNEL_ID;
  if (logChannelId) {
    try {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sorted = [...messages.values()].reverse();
      const transcript = sorted
        .map((m) => `[${m.author.tag}] ${m.content || '(embed/attachment)'}`)
        .join('\n');

      const logChannel = await interaction.guild.channels.fetch(logChannelId);
      const buffer = Buffer.from(transcript || 'Tidak ada pesan.', 'utf-8');
      await logChannel.send({
        content: `📄 Transcript ticket **${interaction.channel.name}** (ditutup oleh <@${interaction.user.id}>)`,
        files: [{ attachment: buffer, name: `${interaction.channel.name}.txt` }],
      });
    } catch (err) {
      console.warn('Gagal membuat transcript:', err.message);
    }
  }

  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

// ============================================================
// FITUR: STARBOARD
// ============================================================
async function handleStarboardReaction(reaction, user) {
  if (user.bot) return;
  if (reaction.emoji.name !== config.starboardEmoji) return;
  const starboardChannelId = process.env.STARBOARD_CHANNEL_ID;
  const threshold = parseInt(process.env.STARBOARD_THRESHOLD || '3', 10);
  if (!starboardChannelId) return;

  if (reaction.partial) await reaction.fetch().catch(() => {});
  const message = reaction.message;
  if (message.author.bot) return;

  const count = reaction.count;
  if (count < threshold) return;

  const existing = db.getStarboardEntry(message.guildId, message.id);
  const starboardChannel = await message.guild.channels.fetch(starboardChannelId).catch(() => null);
  if (!starboardChannel) return;

  const embed = new EmbedBuilder()
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content || '*(tidak ada teks)*')
    .setColor(0xf1c40f)
    .addFields({ name: 'Sumber', value: `[Lompat ke pesan](${message.url})` })
    .setTimestamp(message.createdAt);

  if (message.attachments.size > 0) {
    embed.setImage(message.attachments.first().url);
  }

  if (existing) {
    try {
      const starMsg = await starboardChannel.messages.fetch(existing.starboardMessageId);
      await starMsg.edit({ content: `${config.starboardEmoji} **${count}** | ${message.channel}`, embeds: [embed] });
    } catch (err) {
      console.warn('Gagal update starboard:', err.message);
    }
  } else {
    const starMsg = await starboardChannel.send({ content: `${config.starboardEmoji} **${count}** | ${message.channel}`, embeds: [embed] });
    db.addStarboardEntry(message.guildId, message.id, starMsg.id);
  }
}

// ============================================================
// FITUR: GIVEAWAY CHECKER (cron tiap menit)
// ============================================================
async function checkGiveaways() {
  const active = db.getActiveGiveaways();
  const now = Date.now();
  for (const g of active) {
    if (g.endTime > now) continue;
    try {
      const channel = await client.channels.fetch(g.channelId);
      const message = await channel.messages.fetch(g.messageId);
      const reaction = message.reactions.cache.get('🎉');
      const users = reaction ? await reaction.users.fetch() : new Map();
      const participants = [...users.values()].filter((u) => !u.bot);

      db.markGiveawayEnded(g.id);

      if (participants.length === 0) {
        await channel.send(`😢 Giveaway **${g.prize}** berakhir, tapi tidak ada yang ikut.`);
        continue;
      }

      const shuffled = participants.sort(() => 0.5 - Math.random());
      const winners = shuffled.slice(0, g.winnerCount);
      await channel.send(
        `🎉 Giveaway **${g.prize}** berakhir! Selamat ${winners.map((w) => `<@${w.id}>`).join(', ')}!`
      );
    } catch (err) {
      console.warn('Gagal proses giveaway:', err.message);
      db.markGiveawayEnded(g.id);
    }
  }
}

// ============================================================
// FITUR: YOUTUBE NOTIFICATION (cron tiap 5 menit)
// ============================================================
async function checkYoutube() {
  const ytChannelId = process.env.YOUTUBE_CHANNEL_ID;
  const announceChannelId = process.env.YOUTUBE_ANNOUNCE_CHANNEL_ID;
  if (!ytChannelId || !announceChannelId) return;
  try {
    const newVideo = await youtube.checkLatestVideo(ytChannelId);
    if (newVideo) {
      const channel = await client.channels.fetch(announceChannelId);
      await channel.send(`📺 Video baru nih! **${newVideo.title}**\n${newVideo.url}`);
    }
  } catch (err) {
    console.warn('Gagal cek YouTube:', err.message);
  }
}

// ============================================================
// EVENT: READY
// ============================================================
client.once('clientReady', () => {
  console.log(`${config.botName} online sebagai ${client.user.tag}`);

  cron.schedule('0 9 * * *', sendDailyPfps); // pfp harian jam 09:00
  cron.schedule('* * * * *', checkGiveaways); // cek giveaway tiap menit
  cron.schedule('*/5 * * * *', checkYoutube); // cek YouTube tiap 5 menit

  console.log('Semua jadwal otomatis aktif.');
});

// ============================================================
// EVENT: INTERACTION (slash command + button)
// ============================================================
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = allCommands.find((c) => c.data.name === interaction.commandName);
      if (command) await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (TICKET_LABELS[id]) {
        return handleTicketCreate(interaction, id);
      }
      if (id === 'ticket_close') {
        return handleTicketClose(interaction);
      }
      if (id.startsWith('rolebutton_')) {
        const roleId = id.replace('rolebutton_', '');
        const member = interaction.member;
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          return interaction.reply({ content: `❌ Role <@&${roleId}> dilepas.`, ephemeral: true });
        } else {
          await member.roles.add(roleId);
          return interaction.reply({ content: `✅ Role <@&${roleId}> diklaim.`, ephemeral: true });
        }
      }
    }
  } catch (err) {
    console.error('Error interactionCreate:', err);
    const reply = { content: '❌ Terjadi error.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});

// ============================================================
// EVENT: MESSAGE (pfp test, automod, leveling)
// ============================================================
client.on('messageCreate', async (message) => {
  if (message.content === '!pfp' && !message.author.bot) {
    await sendDailyPfps();
    return;
  }
  const blocked = await handleAutoModeration(message);
  if (!blocked) await handleLeveling(message);
});

// ============================================================
// EVENT: REACTION (starboard)
// ============================================================
client.on('messageReactionAdd', handleStarboardReaction);

// ============================================================
// EVENT: MEMBER JOIN (welcome + auto-role)
// ============================================================
client.on('guildMemberAdd', async (member) => {
  const welcomeId = process.env.WELCOME_CHANNEL_ID;
  if (welcomeId) {
    try {
      const channel = await member.guild.channels.fetch(welcomeId);
      const embed = new EmbedBuilder()
        .setTitle(`👋 Selamat datang di ${member.guild.name}!`)
        .setDescription(`Halo <@${member.id}>, semoga betah ya!`)
        .setThumbnail(member.user.displayAvatarURL())
        .setColor(0x2ecc71);
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.warn('Gagal kirim welcome:', err.message);
    }
  }

  const autoRoleId = process.env.AUTOROLE_ID;
  if (autoRoleId) {
    try {
      await member.roles.add(autoRoleId);
    } catch (err) {
      console.warn('Gagal auto-role:', err.message);
    }
  }
});

// ============================================================
// EVENT: MEMBER LEAVE (goodbye)
// ============================================================
client.on('guildMemberRemove', async (member) => {
  const goodbyeId = process.env.GOODBYE_CHANNEL_ID;
  if (!goodbyeId) return;
  try {
    const channel = await member.guild.channels.fetch(goodbyeId);
    const embed = new EmbedBuilder()
      .setDescription(`👋 **${member.user.tag}** telah meninggalkan server.`)
      .setColor(0xe74c3c);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.warn('Gagal kirim goodbye:', err.message);
  }
});

// ============================================================
// EVENT: MEMBER UPDATE (boost notification)
// ============================================================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const boostId = process.env.BOOST_CHANNEL_ID;
  if (!boostId) return;
  if (!oldMember.premiumSince && newMember.premiumSince) {
    try {
      const channel = await newMember.guild.channels.fetch(boostId);
      const embed = new EmbedBuilder()
        .setDescription(`🚀 <@${newMember.id}> baru saja nge-boost server ini! Makasih banyak!`)
        .setColor(0xe91e63);
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.warn('Gagal kirim boost notif:', err.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
