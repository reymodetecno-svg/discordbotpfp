// youtube.js — cek video terbaru dari channel YouTube pakai RSS feed publik
// (tidak perlu API key). Dipanggil berkala lewat cron di index.js.

let lastVideoId = null;

async function checkLatestVideo(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  const xml = await res.text();

  const idMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
  const titleMatch = xml.match(/<title>(.*?)<\/title>/g); // elemen pertama title = judul channel, kedua = judul video
  const videoId = idMatch ? idMatch[1] : null;
  const videoTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/<\/?title>/g, '') : 'Video baru';

  if (!videoId) return null;

  if (lastVideoId === null) {
    // Pertama kali jalan: simpan tapi jangan announce (biar gak spam video lama)
    lastVideoId = videoId;
    return null;
  }

  if (videoId !== lastVideoId) {
    lastVideoId = videoId;
    return { videoId, title: videoTitle, url: `https://www.youtube.com/watch?v=${videoId}` };
  }

  return null;
}

module.exports = { checkLatestVideo };
