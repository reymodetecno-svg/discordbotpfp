// deploy-commands.js
// Jalankan file ini SEKALI (atau tiap kali nambah/ubah command) buat daftarin
// slash command ke server Discord kamu: node deploy-commands.js

const { REST, Routes } = require('discord.js');
require('dotenv').config();
const commands = require('./commands');

const body = commands.map((cmd) => cmd.data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Mendaftarkan ${body.length} slash command...`);

    // Daftar ke 1 server dulu (GUILD_ID) biar langsung muncul (gak perlu nunggu ~1 jam
    // seperti kalau daftar global). Kalau GUILD_ID kosong, daftar global.
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body }
      );
      console.log('✅ Command berhasil didaftarkan ke server (guild).');
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body });
      console.log('✅ Command berhasil didaftarkan secara global (bisa telat muncul ~1 jam).');
    }
  } catch (err) {
    console.error(err);
  }
})();
