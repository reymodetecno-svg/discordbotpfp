// deploy-commands.js — jalankan SEKALI (atau tiap nambah/ubah command): node deploy-commands.js
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const allCommands = [
  ...require('./commands/moderation'),
  ...require('./commands/member'),
  ...require('./commands/server'),
  ...require('./commands/engagement'),
  ...require('./commands/ticket'),
];

const body = allCommands.map((cmd) => cmd.data.toJSON());
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Mendaftarkan ${body.length} slash command untuk NedeerVilleBOT...`);
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body });
      console.log('✅ Command berhasil didaftarkan ke server (guild) — langsung muncul.');
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body });
      console.log('✅ Command berhasil didaftarkan global (bisa telat muncul ~1 jam).');
    }
  } catch (err) {
    console.error(err);
  }
})();
