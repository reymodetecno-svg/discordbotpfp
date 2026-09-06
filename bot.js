// bot.js — NedeerVilleBOT: kirim 5 random pfp otomatis tiap 24 jam
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

// Fix: beberapa hosting (Railway, Render, dll) gagal resolve DNS lewat IPv6.
require('dns').setDefaultResultOrder('ipv4first');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

// ==== Sumber gambar random pfp ====
// Campuran: foto wajah realistis (gaya pp WA/sosmed), foto aesthetic, dan kucing lucu.
async function getRandomImageUrl() {
  const categories = ['realistic', 'realistic', 'aesthetic', 'cat'];
  const category = categories[Math.floor(Math.random() * categories.length)];

  try {
    if (category === 'realistic') {
      // Foto wajah manusia realistis hasil AI (bukan orang beneran), cocok gaya pfp WA/sosmed.
      // Situs ini langsung ngasih file gambar tiap request, jadi URL-nya langsung dipakai
      // di embed (Discord akan hotlink otomatis dan ambil gambar terbaru tiap kali).
      return 'https://thispersondoesnotexist.com/';
    }

    if (category === 'cat') {
      const res = await fetch('https://api.thecatapi.com/v1/images/search');
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

async function getMultiplePfps(count) {
  const urls = [];
  for (let i = 0; i < count; i++) {
    urls.push(await getRandomImageUrl());
  }
  return urls;
}

async function sendDailyPfps() {
  try {
    if (!TARGET_CHANNEL_ID) {
      console.error('TARGET_CHANNEL_ID belum diisi di environment variable.');
      return;
    }
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    const urls = await getMultiplePfps(5);

    const embeds = urls.map((url, i) =>
      new EmbedBuilder().setTitle(`Random PFP #${i + 1}`).setImage(url).setColor(0x5865f2)
    );

    await channel.send({ content: '✨ **Random PFP hari ini!**', embeds });
    console.log(`[${new Date().toLocaleString()}] 5 pfp berhasil dikirim.`);
  } catch (err) {
    console.error('Gagal mengirim pfp:', err.message);
  }
}

client.once('clientReady', () => {
  console.log(`NedeerVilleBOT online sebagai ${client.user.tag}`);
  cron.schedule('0 9 * * *', sendDailyPfps); // jam 09:00 tiap hari
  console.log('Jadwal pengiriman pfp otomatis aktif (tiap hari jam 09:00).');
});

// Command manual buat testing: ketik !pfp di channel manapun
client.on('messageCreate', async (message) => {
  if (message.content === '!pfp' && !message.author.bot) {
    await sendDailyPfps();
  }
});

client.login(process.env.DISCORD_TOKEN);
