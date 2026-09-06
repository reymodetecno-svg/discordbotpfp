// commands.js
// Definisi slash command moderation + fungsi eksekusinya.
// Setiap command butuh izin ModerateMembers/KickMembers/BanMembers
// (pakai izin bawaan Discord, bukan role custom).

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { addWarning, getWarnings, clearWarnings } = require('./database');
const config = require('./config.json');

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// Kirim embed ke channel log warning (kalau LOG_CHANNEL_ID diisi)
async function sendLog(guild, embed) {
  if (!LOG_CHANNEL_ID) return;
  try {
    const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.warn('Gagal kirim log:', err.message);
  }
}

const commands = [
  // ==== /warn ====
  {
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Beri peringatan ke member')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member yang di-warn').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Alasan warning').setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'Tidak ada alasan';

      addWarning(interaction.guildId, target.id, interaction.user.id, reason);
      const total = getWarnings(interaction.guildId, target.id).length;

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Member diperingatkan')
        .setColor(0xf1c40f)
        .addFields(
          { name: 'Member', value: `<@${target.id}>`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Alasan', value: reason },
          { name: 'Total warning', value: `${total}` }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await sendLog(interaction.guild, embed);

      // Auto timeout kalau warning sudah mencapai batas
      if (total >= config.autoTimeoutAfterWarnings) {
        try {
          const member = await interaction.guild.members.fetch(target.id);
          await member.timeout(
            config.autoTimeoutMinutes * 60 * 1000,
            `Auto-timeout: mencapai ${total} warning`
          );
          await interaction.followUp(
            `🔇 <@${target.id}> otomatis di-timeout ${config.autoTimeoutMinutes} menit karena sudah ${total} kali warning.`
          );
        } catch (err) {
          console.warn('Gagal auto-timeout:', err.message);
        }
      }
    },
  },

  // ==== /warnings (cek riwayat) ====
  {
    data: new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('Lihat riwayat warning member')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member yang dicek').setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('user');
      const list = getWarnings(interaction.guildId, target.id);

      if (list.length === 0) {
        return interaction.reply(`<@${target.id}> belum pernah kena warning.`);
      }

      const desc = list
        .slice(0, 10)
        .map(
          (w, i) =>
            `**${i + 1}.** ${w.reason} — oleh <@${w.moderatorId}> (<t:${Math.floor(
              w.timestamp / 1000
            )}:R>)`
        )
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`Riwayat warning: ${target.username}`)
        .setDescription(desc)
        .setColor(0xf1c40f);

      await interaction.reply({ embeds: [embed] });
    },
  },

  // ==== /clearwarnings ====
  {
    data: new SlashCommandBuilder()
      .setName('clearwarnings')
      .setDescription('Hapus semua warning member')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member yang di-reset').setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('user');
      clearWarnings(interaction.guildId, target.id);
      await interaction.reply(`✅ Semua warning <@${target.id}> sudah dihapus.`);
    },
  },

  // ==== /mute (timeout) ====
  {
    data: new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Timeout (bisukan) member sementara')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member yang di-mute').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('menit')
          .setDescription('Durasi mute dalam menit')
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Alasan mute').setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('user');
      const minutes = interaction.options.getInteger('menit');
      const reason = interaction.options.getString('reason') || 'Tidak ada alasan';

      const member = await interaction.guild.members.fetch(target.id);
      await member.timeout(minutes * 60 * 1000, reason);

      const embed = new EmbedBuilder()
        .setTitle('🔇 Member di-mute')
        .setColor(0xe67e22)
        .addFields(
          { name: 'Member', value: `<@${target.id}>`, inline: true },
          { name: 'Durasi', value: `${minutes} menit`, inline: true },
          { name: 'Alasan', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await sendLog(interaction.guild, embed);
    },
  },

  // ==== /kick ====
  {
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick member dari server')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member yang di-kick').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Alasan kick').setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'Tidak ada alasan';

      const member = await interaction.guild.members.fetch(target.id);
      await member.kick(reason);

      const embed = new EmbedBuilder()
        .setTitle('👢 Member di-kick')
        .setColor(0xe74c3c)
        .addFields(
          { name: 'Member', value: `${target.tag}`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Alasan', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await sendLog(interaction.guild, embed);
    },
  },

  // ==== /ban ====
  {
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban member dari server')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('Member yang di-ban').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Alasan ban').setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'Tidak ada alasan';

      await interaction.guild.members.ban(target.id, { reason });

      const embed = new EmbedBuilder()
        .setTitle('🔨 Member di-ban')
        .setColor(0x992d22)
        .addFields(
          { name: 'Member', value: `${target.tag}`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Alasan', value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await sendLog(interaction.guild, embed);
    },
  },

  // ==== /clear ====
  {
    data: new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Hapus sejumlah pesan terakhir di channel ini')
      .addIntegerOption((opt) =>
        opt
          .setName('jumlah')
          .setDescription('Jumlah pesan yang dihapus (max 100)')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const amount = interaction.options.getInteger('jumlah');
      if (amount < 1 || amount > 100) {
        return interaction.reply({
          content: 'Jumlah harus antara 1-100.',
          ephemeral: true,
        });
      }
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({
        content: `🧹 ${deleted.size} pesan berhasil dihapus.`,
        ephemeral: true,
      });
    },
  },
];

module.exports = commands;
