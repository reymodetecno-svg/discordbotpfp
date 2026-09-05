// bot.js
// Bot Discord: kirim 5 random pfp otomatis tiap 24 jam ke channel tertentu

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// ID channel tempat pfp akan dikirim otomatis
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

// ==== Sumber gambar random pfp ====
// Default pakai waifu.pics (anime style, gratis, tanpa API key).
// Kalau mau pfp jenis lain, tinggal ganti fungsi ini.
async function getRandomPfpUrl() {
  const res = await fetch('https://api.waifu.pics/sfw/waifu');
  const data = await res.json();
  return data.url;
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
