const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('ticket-panel')
      .setDescription('Kirim panel ticket ke channel ini')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const embed = new EmbedBuilder()
        .setTitle('🎫 Butuh Bantuan?')
        .setDescription(
          'Klik salah satu tombol di bawah sesuai kebutuhan kamu, nanti akan dibuatkan channel private untuk ngobrol sama staff.'
        )
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_support').setLabel('Support').setEmoji('🛠️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_report').setLabel('Report Member').setEmoji('🚨').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_partnership').setLabel('Partnership').setEmoji('🤝').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket_question').setLabel('Question').setEmoji('❓').setStyle(ButtonStyle.Secondary)
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ Panel ticket terkirim.', ephemeral: true });
    },
  },
];
