const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('lock')
      .setDescription('Kunci channel ini (member tidak bisa kirim pesan)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false,
      });
      await interaction.reply('🔒 Channel ini sudah dikunci.');
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('Buka kunci channel ini')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null,
      });
      await interaction.reply('🔓 Channel ini sudah dibuka lagi.');
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('slowmode')
      .setDescription('Atur slowmode channel ini')
      .addIntegerOption((o) => o.setName('detik').setDescription('Jeda dalam detik (0 = matikan)').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
      const seconds = interaction.options.getInteger('detik');
      await interaction.channel.setRateLimitPerUser(seconds);
      await interaction.reply(seconds === 0 ? '✅ Slowmode dimatikan.' : `🐢 Slowmode diatur ke ${seconds} detik.`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('Kirim pengumuman ke channel tertentu')
      .addChannelOption((o) =>
        o.setName('channel').setDescription('Channel tujuan').addChannelTypes(ChannelType.GuildText).setRequired(true)
      )
      .addStringOption((o) => o.setName('pesan').setDescription('Isi pengumuman').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('pesan');
      const embed = new EmbedBuilder()
        .setTitle('📢 Pengumuman')
        .setDescription(message)
        .setColor(0x3498db)
        .setFooter({ text: `Oleh ${interaction.user.tag}` })
        .setTimestamp();
      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Pengumuman terkirim ke <#${channel.id}>.`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('poll')
      .setDescription('Buat polling sederhana (max 4 pilihan)')
      .addStringOption((o) => o.setName('pertanyaan').setDescription('Pertanyaan polling').setRequired(true))
      .addStringOption((o) => o.setName('pilihan1').setDescription('Pilihan 1').setRequired(true))
      .addStringOption((o) => o.setName('pilihan2').setDescription('Pilihan 2').setRequired(true))
      .addStringOption((o) => o.setName('pilihan3').setDescription('Pilihan 3'))
      .addStringOption((o) => o.setName('pilihan4').setDescription('Pilihan 4')),
    async execute(interaction) {
      const question = interaction.options.getString('pertanyaan');
      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
      const options = [1, 2, 3, 4]
        .map((n) => interaction.options.getString(`pilihan${n}`))
        .filter(Boolean);

      const desc = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${question}`)
        .setDescription(desc)
        .setColor(0x9b59b6)
        .setFooter({ text: `Polling oleh ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
      const msg = await interaction.fetchReply();
      for (let i = 0; i < options.length; i++) {
        await msg.react(emojis[i]);
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('embed')
      .setDescription('Kirim pesan custom dalam bentuk embed')
      .addStringOption((o) => o.setName('judul').setDescription('Judul embed').setRequired(true))
      .addStringOption((o) => o.setName('isi').setDescription('Isi pesan').setRequired(true))
      .addStringOption((o) => o.setName('warna').setDescription('Warna hex, misal #5865F2'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const title = interaction.options.getString('judul');
      const desc = interaction.options.getString('isi').replace(/\\n/g, '\n');
      const color = interaction.options.getString('warna') || '#5865F2';
      const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color);
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('say')
      .setDescription('Bot mengirim pesan seolah dari bot')
      .addStringOption((o) => o.setName('pesan').setDescription('Isi pesan').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const message = interaction.options.getString('pesan').replace(/\\n/g, '\n');
      await interaction.channel.send(message);
      await interaction.reply({ content: '✅ Terkirim.', ephemeral: true });
    },
  },
];
