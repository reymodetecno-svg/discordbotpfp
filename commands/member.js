const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const config = require('../config.json');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('profile')
      .setDescription('Lihat profil level/XP kamu atau member lain')
      .addUserOption((o) => o.setName('user').setDescription('Member yang dicek')),
    async execute(interaction) {
      const target = interaction.options.getUser('user') || interaction.user;
      const data = db.getLevel(interaction.guildId, target.id);
      const rank = db.getRank(interaction.guildId, target.id);
      const xpNeeded = config.leveling.xpBaseForLevelUp * (data.level + 1);
      const embed = new EmbedBuilder()
        .setTitle(`Profil ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .setColor(0x5865f2)
        .addFields(
          { name: 'Level', value: `${data.level}`, inline: true },
          { name: 'XP', value: `${data.xp}/${xpNeeded}`, inline: true },
          { name: 'Peringkat', value: `#${rank || '-'}`, inline: true }
        );
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('avatar')
      .setDescription('Lihat avatar member')
      .addUserOption((o) => o.setName('user').setDescription('Member yang dicek')),
    async execute(interaction) {
      const target = interaction.options.getUser('user') || interaction.user;
      const embed = new EmbedBuilder()
        .setTitle(`Avatar ${target.username}`)
        .setImage(target.displayAvatarURL({ size: 512 }))
        .setColor(0x5865f2);
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder().setName('serverinfo').setDescription('Lihat info server ini'),
    async execute(interaction) {
      const g = interaction.guild;
      const embed = new EmbedBuilder()
        .setTitle(g.name)
        .setThumbnail(g.iconURL())
        .setColor(0x5865f2)
        .addFields(
          { name: 'Pemilik', value: `<@${g.ownerId}>`, inline: true },
          { name: 'Member', value: `${g.memberCount}`, inline: true },
          { name: 'Dibuat', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
          { name: 'Role', value: `${g.roles.cache.size}`, inline: true },
          { name: 'Channel', value: `${g.channels.cache.size}`, inline: true },
          { name: 'Boost', value: `${g.premiumSubscriptionCount || 0}`, inline: true }
        );
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Lihat info detail member')
      .addUserOption((o) => o.setName('user').setDescription('Member yang dicek')),
    async execute(interaction) {
      const target = interaction.options.getUser('user') || interaction.user;
      const member = await interaction.guild.members.fetch(target.id);
      const embed = new EmbedBuilder()
        .setTitle(`Info: ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .setColor(0x5865f2)
        .addFields(
          { name: 'ID', value: target.id, inline: true },
          { name: 'Nickname', value: member.nickname || '-', inline: true },
          { name: 'Akun dibuat', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
          { name: 'Join server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
          { name: 'Role', value: member.roles.cache.map((r) => `<@&${r.id}>`).join(' ') || '-' }
        );
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder().setName('membercount').setDescription('Lihat jumlah member server'),
    async execute(interaction) {
      const g = interaction.guild;
      const humans = g.members.cache.filter((m) => !m.user.bot).size;
      const bots = g.members.cache.filter((m) => m.user.bot).size;
      await interaction.reply(`👥 Total: **${g.memberCount}** (Manusia: ${humans}, Bot: ${bots})`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('roleinfo')
      .setDescription('Lihat info sebuah role')
      .addRoleOption((o) => o.setName('role').setDescription('Role yang dicek').setRequired(true)),
    async execute(interaction) {
      const role = interaction.options.getRole('role');
      const embed = new EmbedBuilder()
        .setTitle(`Role: ${role.name}`)
        .setColor(role.color || 0x5865f2)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Anggota', value: `${role.members.size}`, inline: true },
          { name: 'Warna', value: role.hexColor, inline: true },
          { name: 'Posisi', value: `${role.position}`, inline: true },
          { name: 'Dibuat', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true }
        );
      await interaction.reply({ embeds: [embed] });
    },
  },
];
