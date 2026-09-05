// bot.js
// Bot Discord: kirim 5 random pfp otomatis tiap 24 jam ke channel tertentu

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

// Fix: beberapa hosting (Railway, Render, dll) gagal resolve DNS lewat IPv6.
// Paksa Node pakai IPv4 dulu supaya fetch() ke API luar tidak ENOTFOUND.
require('dns').setDefaultResultOrder('ipv4first');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ID channel tempat pfp akan dikirim otomatis
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

// ==== Sumber gambar random pfp ====
// Coba waifu.pics dulu, kalau gagal fallback ke nekos.best
async function getRandomPfpUrl() {
  try {
    const res = await fetch('https://api.waifu.pics/sfw/waifu');
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    return data.url;
  } catch (err) {
    console.warn('waifu.pics gagal, coba fallback nekos.best:', err.message);
    const res2 = await fetch('https://nekos.best/api/v2/waifu');
    const data2 = await res2.json();
    return data2.results[0].url;
  }
}

// Ambil N gambar random (unik jika API mendukung, kalau tidak ya random biasa)
async function getMultiplePfps(count) {
  const urls = [];
  for (let i = 0; i < count; i++) {
    const url = await getRandomPfpUrl();
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
        .setColor(0x5865f2)
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

// Command manual untuk testing: ketik !pfp di channel manapun
client.on('messageCreate', async (message) => {
  if (message.content === '!pfp' && !message.author.bot) {
    await sendDailyPfps();
  }
});

client.login(process.env.DISCORD_TOKEN);
