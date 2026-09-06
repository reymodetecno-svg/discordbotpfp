// bot.js
// Bot Discord: kirim 5 random pfp otomatis tiap 24 jam ke channel tertentu

const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();
const commands = require('./commands');
const config = require('./config.json');

// Fix: beberapa hosting (Railway, Render, dll) gagal resolve DNS lewat IPv6.
// Paksa Node pakai IPv4 dulu supaya fetch() ke API luar tidak ENOTFOUND.
require('dns').setDefaultResultOrder('ipv4first');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const INVITE_REGEX = /(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/\S+/i;
const LINK_REGEX = /https?:\/\/\S+/i;

// Map buat nyimpen histori pesan tiap user (anti-spam), key: userId, value: array timestamp
const spamTracker = new Map();

async function logModerationAction(guild, embed) {
  if (!LOG_CHANNEL_ID) return;
  try {
    const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.warn('Gagal kirim log moderasi:', err.message);
  }
}

// ==== Cek anti-spam ====
function isSpamming(userId) {
  const now = Date.now();
  const timestamps = (spamTracker.get(userId) || []).filter(
    (t) => now - t < config.antiSpam.timeWindowMs
  );
  timestamps.push(now);
  spamTracker.set(userId, timestamps);
  return timestamps.length > config.antiSpam.maxMessages;
}

// ==== Handler moderasi otomatis untuk tiap pesan masuk ====
async function handleAutoModeration(message) {
  if (message.author.bot || !message.guild) return;
  // Jangan tindak member yang punya izin ManageMessages (biasanya staff)
  if (message.member?.permissions.has('ManageMessages')) return;

  // Anti-link/invite
  if (INVITE_REGEX.test(message.content) || LINK_REGEX.test(message.content)) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send(
      `🔗 <@${message.author.id}>, link/invite tidak diperbolehkan di sini.`
    );
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }

  // Word filter
  const lower = message.content.toLowerCase();
  if (config.wordFilter.some((word) => lower.includes(word.toLowerCase()))) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send(
      `🤬 <@${message.author.id}>, kata-kata itu tidak diperbolehkan di sini.`
    );
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }

  // Anti-spam
  if (isSpamming(message.author.id)) {
    try {
      await message.member.timeout(
        config.antiSpam.timeoutMinutes * 60 * 1000,
        'Terdeteksi spam pesan'
      );
      const embed = new EmbedBuilder()
        .setTitle('🚫 Anti-spam terpicu')
        .setColor(0xe67e22)
        .setDescription(
          `<@${message.author.id}> di-timeout ${config.antiSpam.timeoutMinutes} menit karena mengirim pesan terlalu cepat.`
        )
        .setTimestamp();
      await message.channel.send({ embeds: [embed] });
      await logModerationAction(message.guild, embed);
      spamTracker.delete(message.author.id);
    } catch (err) {
      console.warn('Gagal auto-timeout spam:', err.message);
    }
  }
}

// ID channel tempat pfp akan dikirim otomatis
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

// ==== Sumber gambar random pfp ====
// Campuran beberapa kategori biar hasilnya variatif kayak koleksi "aesthetic pfp":
// - anime/manga (waifu.pics, macam-macam endpoint biar gak itu-itu terus)
// - kucing lucu (TheCatAPI)
// - foto aesthetic/nature (Picsum, kadang grayscale biar mirip contoh)
async function getRandomImageUrl() {
  const categories = ['anime', 'cat', 'aesthetic'];
  const category = categories[Math.floor(Math.random() * categories.length)];

  try {
    if (category === 'anime') {
      const endpoints = ['waifu', 'neko', 'megumin', 'shinobu', 'smile', 'blush'];
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const res = await fetch(`https://api.waifu.pics/sfw/${ep}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data.url;
    }

    if (category === 'cat') {
      const res = await fetch('https://api.thecatapi.com/v1/images/search');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data[0].url;
    }

    // aesthetic: foto random, sebagian dibikin grayscale biar berasa moody/estetik
    const seed = Math.floor(Math.random() * 100000);
    const grayscale = Math.random() < 0.5 ? '?grayscale' : '';
    return `https://picsum.photos/seed/${seed}/500/500${grayscale}`;
  } catch (err) {
    console.warn(`Gagal ambil dari kategori ${category}, fallback ke picsum:`, err.message);
    const seed = Math.floor(Math.random() * 100000);
    return `https://picsum.photos/seed/${seed}/500/500`;
  }
}

// Ambil N gambar random
async function getMultiplePfps(count) {
  const urls = [];
  for (let i = 0; i < count; i++) {
    const url = await getRandomImageUrl();
    urls.push(url);
  }
  return urls;
}

// Fungsi utama: kirim 5 pfp ke channel target
async function sendDailyPfps() {
  try {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel) {
      console.error('Channel tidak ditemukan. Cek TARGET_CHANNEL_ID.');
      return;
    }

    const urls = await getMultiplePfps(5);

    const embeds = urls.map((url, i) =>
      new EmbedBuilder()
        .setTitle(`Random PFP #${i + 1}`)
        .setImage(url)
        .setColor(0x2b2d31)
    );

    await channel.send({
      content: '✨ **Random PFP hari ini!**',
      embeds,
    });

    console.log(`[${new Date().toLocaleString()}] 5 pfp berhasil dikirim.`);
  } catch (err) {
    console.error('Gagal mengirim pfp:', err);
  }
}

client.once('ready', () => {
  console.log(`Bot login sebagai ${client.user.tag}`);

  // Jadwalkan setiap 24 jam, jalan tiap hari jam 09:00 waktu server
  // Format cron: menit jam tanggal bulan hari
  cron.schedule('0 9 * * *', () => {
    sendDailyPfps();
  });

  console.log('Jadwal pengiriman pfp otomatis sudah aktif (tiap hari jam 09:00).');
});

// Handler slash command
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find((c) => c.data.name === interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error di command /${interaction.commandName}:`, err);
    const reply = { content: '❌ Terjadi error saat menjalankan command ini.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Command manual untuk testing pfp: ketik !pfp di channel manapun
// + jalankan auto-moderation (anti-spam, anti-link, word filter) tiap pesan masuk
client.on('messageCreate', async (message) => {
  if (message.content === '!pfp' && !message.author.bot) {
    await sendDailyPfps();
    return;
  }
  await handleAutoModeration(message);
});

client.login(process.env.DISCORD_TOKEN);
