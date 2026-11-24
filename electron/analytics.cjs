// Holt Zahlen aus der YouTube Analytics API für einen verbundenen eigenen Kanal
// und speichert sie als analytics.json im Kanal-Ordner (liest auch Claude).
const fs = require('fs');
const path = require('path');
const { apiGet } = require('./google.cjs');

const API = 'https://youtubeanalytics.googleapis.com/v2/reports';
const day = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; };

// Analytics-Antwort (columnHeaders + rows) in Objekte umwandeln.
function rowsToObjects(res) {
  const cols = (res.columnHeaders || []).map((c) => c.name);
  return (res.rows || []).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

function sumRange(rows, from, to) {
  const part = rows.filter((r) => r.day >= from && r.day <= to);
  const sum = (k) => part.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const views = sum('views');
  return {
    from, to,
    views,
    watchMinutes: Math.round(sum('estimatedMinutesWatched')),
    subscribersGained: sum('subscribersGained'),
    subscribersLost: sum('subscribersLost'),
    likes: sum('likes'),
    // Gewichteter Mittelwert der Wiedergabedauer
    avgViewDurationSec: views ? Math.round(part.reduce((s, r) => s + (Number(r.averageViewDuration) || 0) * (Number(r.views) || 0), 0) / views) : null,
  };
}

async function fetchAnalytics({ token, titles = {}, fetchTitles }) {
  const end = daysAgo(1); // Analytics-Daten haben 1–3 Tage Verzögerung
  const start56 = daysAgo(56);
  const start90 = daysAgo(90);
  const q = (params) => `${API}?${new URLSearchParams({ ids: 'channel==MINE', endDate: day(end), ...params })}`;

  const daily = rowsToObjects(
    await apiGet(q({ startDate: day(start56), dimensions: 'day', sort: 'day', metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes' }), token)
  );

  const videos = rowsToObjects(
    await apiGet(q({ startDate: day(start90), dimensions: 'video', sort: '-views', maxResults: '50', metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes' }), token)
  );

  // Impressionen und Klickrate gibt es nicht für jeden Kanal/Zeitraum – optional abfragen.
  let ctrAvailable = false;
  try {
    const ctr = rowsToObjects(
      await apiGet(q({ startDate: day(start90), dimensions: 'video', sort: '-views', maxResults: '50', metrics: 'views,videoThumbnailImpressions,videoThumbnailImpressionsClickRate' }), token)
    );
    const byId = Object.fromEntries(ctr.map((r) => [r.video, r]));
    for (const v of videos) {
      const c = byId[v.video];
      if (c) {
        v.impressions = Number(c.videoThumbnailImpressions) || 0;
        v.ctr = c.videoThumbnailImpressionsClickRate != null ? Number(c.videoThumbnailImpressionsClickRate) : null;
      }
    }
    ctrAvailable = ctr.length > 0;
  } catch {}

  const missing = videos.map((v) => v.video).filter((id) => !titles[id]);
  if (missing.length && fetchTitles) Object.assign(titles, await fetchTitles(missing).catch(() => ({})));

  const d = (n) => day(daysAgo(n));
  return {
    fetchedAt: new Date().toISOString(),
    range: { from: day(start56), to: day(end) },
    last28: sumRange(daily, d(28), day(end)),
    prev28: sumRange(daily, day(start56), d(29)),
    daily: daily.map((r) => ({
      day: r.day,
      views: Number(r.views) || 0,
      watchMinutes: Math.round(Number(r.estimatedMinutesWatched) || 0),
      subscribersGained: Number(r.subscribersGained) || 0,
      subscribersLost: Number(r.subscribersLost) || 0,
    })),
    videosRange: { from: day(start90), to: day(end) },
    ctrAvailable,
    videos: videos.map((v) => ({
      id: v.video,
      title: titles[v.video] || null,
      views: Number(v.views) || 0,
      watchMinutes: Math.round(Number(v.estimatedMinutesWatched) || 0),
      avgViewDurationSec: Math.round(Number(v.averageViewDuration) || 0),
      avgViewPercent: v.averageViewPercentage != null ? Math.round(Number(v.averageViewPercentage) * 10) / 10 : null,
      subscribersGained: Number(v.subscribersGained) || 0,
      likes: Number(v.likes) || 0,
      impressions: v.impressions ?? null,
      ctr: v.ctr ?? null,
    })),
  };
}

async function syncAnalytics({ dir, token }) {
  let titles = {};
  try {
    const vids = JSON.parse(fs.readFileSync(path.join(dir, 'videos.json'), 'utf8')).videos || [];
    titles = Object.fromEntries(vids.map((v) => [v.id, v.title]));
  } catch {}
  const fetchTitles = async (ids) => {
    const out = {};
    for (let i = 0; i < ids.length; i += 50) {
      const res = await apiGet(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.slice(i, i + 50).join(',')}`, token);
      for (const it of res.items || []) out[it.id] = it.snippet.title;
    }
    return out;
  };
  const data = await fetchAnalytics({ token, titles, fetchTitles });
  const tmp = path.join(dir, 'analytics.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, path.join(dir, 'analytics.json'));
  return data;
}

function readAnalytics(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'analytics.json'), 'utf8')); } catch { return null; }
}

module.exports = { syncAnalytics, readAnalytics, sumRange, rowsToObjects };
