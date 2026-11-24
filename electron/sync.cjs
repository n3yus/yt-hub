// Gleicht Kanäle mit YouTube ab: Kanaldaten, letzte Uploads, Ausreißer.
// Kosten pro Kanal: ca. 3 Einheiten (channels + playlistItems + videos).
const fs = require('fs');
const path = require('path');

const SHORT_MAX_SEC = 180; // YouTube Shorts dürfen bis zu 3 Minuten lang sein
const MIN_AGE_DAYS = 3; // jüngere Videos fließen nicht in den Vergleichswert ein
const MIN_BASELINE = 5;
const OUTLIER = 2; // ab 2× Median: Ausreißer
const STRONG_OUTLIER = 5;

function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x) || 0);
  return d * 86400 + h * 3600 + min * 60 + s;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const num = (v) => (v === undefined || v === null ? null : Number(v));

function toVideo(item) {
  const durationSec = parseDuration(item.contentDetails?.duration);
  const t = item.snippet.thumbnails || {};
  return {
    id: item.id,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    durationSec,
    isShort: durationSec > 0 && durationSec <= SHORT_MAX_SEC,
    isLive: item.snippet.liveBroadcastContent && item.snippet.liveBroadcastContent !== 'none',
    views: num(item.statistics?.viewCount),
    likes: num(item.statistics?.likeCount),
    comments: num(item.statistics?.commentCount),
    thumbnail: (t.medium || t.high || t.default || {}).url || null,
  };
}

// Vergleicht jedes Video mit dem Median der übrigen Videos desselben Formats
// (Shorts mit Shorts, lange Videos mit langen), die mindestens 3 Tage alt sind.
function scoreOutliers(videos, now = Date.now()) {
  const ageDays = (v) => (now - new Date(v.publishedAt).getTime()) / 86400000;
  return videos.map((v) => {
    if (v.views === null || v.isLive) return { ...v, score: null, outlier: null };
    const baseline = videos
      .filter((o) => o.id !== v.id && o.isShort === v.isShort && o.views !== null && !o.isLive && ageDays(o) >= MIN_AGE_DAYS)
      .map((o) => o.views);
    const med = baseline.length >= MIN_BASELINE ? median(baseline) : null;
    if (!med) return { ...v, score: null, outlier: null };
    const score = Math.round((v.views / med) * 10) / 10;
    const outlier = score >= STRONG_OUTLIER ? 'strong' : score >= OUTLIER ? 'yes' : null;
    return { ...v, score, outlier, young: ageDays(v) < MIN_AGE_DAYS };
  });
}

function writeJson(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function syncChannel({ dir, youtube }) {
  const metaFile = path.join(dir, 'channel.json');
  const meta = readJson(metaFile, null);
  if (!meta) throw new Error('channel.json fehlt.');

  try {
    const source = meta.youtubeId ? { kind: 'id', value: meta.youtubeId } : meta.source;
    const ch = await youtube.resolveChannel(source);
    const t = ch.snippet.thumbnails || {};
    const uploads = ch.contentDetails?.relatedPlaylists?.uploads || null;

    let videos = [];
    if (uploads) {
      try {
        const ids = await youtube.recentUploadIds(uploads, 50);
        videos = (await youtube.videos(ids)).map(toVideo);
      } catch (err) {
        if (err.reason !== 'playlistNotFound') throw err; // Kanal ohne Uploads
      }
    }
    videos = scoreOutliers(videos).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

    const updated = {
      ...meta,
      name: meta.customName ? meta.name : ch.snippet.title,
      youtubeId: ch.id,
      handle: ch.snippet.customUrl || (meta.source.kind === 'handle' ? meta.source.value : null),
      url: `https://www.youtube.com/channel/${ch.id}`,
      thumbnail: (t.medium || t.default || t.high || {}).url || null,
      description: (ch.snippet.description || '').slice(0, 500),
      country: ch.snippet.country || null,
      stats: {
        subscribers: ch.statistics?.hiddenSubscriberCount ? null : num(ch.statistics?.subscriberCount),
        videos: num(ch.statistics?.videoCount),
        views: num(ch.statistics?.viewCount),
      },
      uploadsPlaylistId: uploads,
      lastSync: new Date().toISOString(),
      lastSyncError: null,
    };
    if (updated.handle) updated.url = `https://www.youtube.com/${updated.handle}`;

    writeJson(path.join(dir, 'videos.json'), { syncedAt: updated.lastSync, videos });
    writeJson(metaFile, updated);
    return { ok: true, channel: updated, videoCount: videos.length };
  } catch (err) {
    // Fehler am Kanal vermerken, damit die Karte ihn zeigen kann – außer bei fehlendem Key/Kontingent.
    if (err.reason !== 'noKey' && err.reason !== 'quota' && err.reason !== 'network') {
      writeJson(metaFile, { ...meta, lastSyncError: err.message, lastSyncAttempt: new Date().toISOString() });
    }
    throw err;
  }
}

module.exports = { syncChannel, scoreOutliers, parseDuration, median, readJson };
