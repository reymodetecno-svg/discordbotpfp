// bot.js
// Bot Discord: kirim 5 random pfp otomatis tiap 24 jam ke channel tertentu

const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
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

// Command manual untuk testing: ketik !pfp di channel manapun
client.on('messageCreate', async (message) => {
  if (message.content === '!pfp' && !message.author.bot) {
    await sendDailyPfps();
  }
});

client.login(process.env.DISCORD_TOKEN);
