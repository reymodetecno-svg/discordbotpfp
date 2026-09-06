const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../database');

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return num * mult[unit];
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Mulai giveaway')
      .addStringOption((o) => o.setName('hadiah').setDescription('Nama hadiah').setRequired(true))
      .addStringOption((o) =>
        o.setName('durasi').setDescription('Contoh: 30s, 10m, 2h, 1d').setRequired(true)
      )
      .addIntegerOption((o) => o.setName('pemenang').setDescription('Jumlah pemenang').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const prize = interaction.options.getString('hadiah');
      const durationStr = interaction.options.getString('durasi');
      const winnerCount = interaction.options.getInteger('pemenang');
      const durationMs = parseDuration(durationStr);

      if (!durationMs) {
        return interaction.reply({
          content: 'Format durasi salah. Contoh yang benar: 30s, 10m, 2h, 1d',
          ephemeral: true,
        });
      }

      const endTime = Date.now() + durationMs;
      const embed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(
          `**Hadiah:** ${prize}\n**Pemenang:** ${winnerCount}\n**Berakhir:** <t:${Math.floor(endTime / 1000)}:R>\n\nReact 🎉 untuk ikutan!`
        )
        .setColor(0xf39c12)
        .setFooter({ text: `Dibuat oleh ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
      const msg = await interaction.fetchReply();
      await msg.react('🎉');

      db.createGiveaway(interaction.guildId, interaction.channelId, msg.id, prize, winnerCount, endTime);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('suggest')
      .setDescription('Kirim saran untuk server ini')
      .addStringOption((o) => o.setName('saran').setDescription('Isi saran kamu').setRequired(true)),
    async execute(interaction) {
      const suggestion = interaction.options.getString('saran');
      const embed = new EmbedBuilder()
        .setTitle('💡 Saran baru')
        .setDescription(suggestion)
        .setColor(0x2ecc71)
        .setFooter({ text: `Dari ${interaction.user.tag}` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      const msg = await interaction.fetchReply();
      await msg.react('👍');
      await msg.react('👎');
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('rolebutton')
      .setDescription('Buat tombol untuk klaim/lepas role otomatis')
      .addRoleOption((o) => o.setName('role').setDescription('Role yang diklaim').setRequired(true))
      .addStringOption((o) => o.setName('label').setDescription('Teks tombol').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
      const role = interaction.options.getRole('role');
      const label = interaction.options.getString('label');
      const button = new ButtonBuilder()
        .setCustomId(`rolebutton_${role.id}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(button);
      await interaction.reply({ content: `Klik tombol di bawah untuk klaim/lepas role <@&${role.id}>`, components: [row] });
    },
  },
];
