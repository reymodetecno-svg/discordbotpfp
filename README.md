# NedeerVilleBOT

Bot Discord full fitur: Moderation, Ticket, Notification, Member Info, Server Management, Engagement.

## Struktur File
```
nedeerville-bot/
├── index.js              # File utama, jalankan ini buat start bot
├── deploy-commands.js    # Jalankan SEKALI buat daftarin slash command
├── database.js           # Koneksi database SQLite (warning, level, giveaway, starboard)
├── youtube.js            # Cek video YouTube terbaru
├── config.json           # Pengaturan (word filter, anti-spam, leveling)
├── package.json
├── .env.example          # Contoh isi environment variable
└── commands/
    ├── moderation.js      # /warn /mute /kick /ban /clear dst
    ├── member.js          # /profile /avatar /serverinfo dst
    ├── server.js          # /lock /unlock /slowmode /announce /poll /embed /say
    ├── engagement.js      # /giveaway /suggest /rolebutton
    └── ticket.js          # /ticket-panel
```

## Cara Setup

1. **Install dependency:**
   ```
   npm install
   ```

2. **Isi environment variable.** Copy `.env.example` jadi `.env`, isi semua yang kamu butuh (lihat penjelasan tiap variable di file itu). Yang WAJIB diisi: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`. Sisanya opsional — kalau kosong, fitur terkait otomatis nonaktif.

3. **Daftarkan slash command (SEKALI SAJA, atau tiap kali nambah command baru):**
   ```
   node deploy-commands.js
   ```

4. **Jalankan bot:**
   ```
   npm start
   ```

## Setup di Discord Developer Portal

- Aktifkan **Message Content Intent**, **Server Members Intent**, dan **Presence Intent** (kalau ada) di tab "Bot".
- Invite bot dengan scope `bot` + `applications.commands`, dan permission minimal: Manage Roles, Manage Channels, Kick Members, Ban Members, Moderate Members, Manage Messages, Read Message History, Send Messages, Embed Links, Attach Files, Add Reactions.

## Catatan Fitur

- **Anti-link/word filter/anti-spam**: berjalan otomatis, staff (role dengan izin Manage Messages) tidak kena filter ini.
- **Auto-timeout**: member otomatis di-timeout kalau kena warning sejumlah `autoTimeoutAfterWarnings` di `config.json`.
- **Ticket system**: jalankan `/ticket-panel` di channel yang kamu mau, nanti member klik tombol buat bikin ticket. Transcript otomatis dikirim ke `TICKET_LOG_CHANNEL_ID` saat ticket ditutup.
- **Starboard**: pesan yang dapat reaksi ⭐ sejumlah `STARBOARD_THRESHOLD` akan di-repost ke `STARBOARD_CHANNEL_ID`.
- **Leveling**: member dapat XP tiap kirim pesan (ada cooldown), cek progress lewat `/profile`.
- **YouTube notification**: pakai RSS feed publik YouTube, jadi TIDAK butuh API key. Cukup isi `YOUTUBE_CHANNEL_ID` (ID channel YouTube-nya, bukan nama) dan `YOUTUBE_ANNOUNCE_CHANNEL_ID`.
- **TikTok notification**: TikTok tidak punya API resmi gratis untuk cek video terbaru, jadi fitur ini belum diimplementasikan. Kalau mau, bisa pakai layanan pihak ketiga berbayar — tanya saya kalau butuh dibantu integrasi nanti.
- **Giveaway**: dicek otomatis tiap menit lewat cron, pemenang diambil random dari yang react 🎉.
- **Reaction/button roles**: pakai `/rolebutton`, bikin 1 tombol per role (bisa dipanggil berkali-kali buat beberapa role berbeda).

## ⚠️ Penting soal Hosting (Railway/dll)

Data (warning, level, giveaway, starboard) disimpan di file `bot.db` (SQLite) di dalam container. Di banyak platform hosting seperti Railway, filesystem bisa ter-reset setiap kali redeploy — artinya data bisa hilang. Kalau data ini penting buat kamu, tambahkan **persistent volume/disk** di platform hosting kamu dan arahkan path database ke situ. Kalau butuh bantuan setup ini, tanya saya.
