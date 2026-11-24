// Nur für den Smoke-Test: ein YouTube-Client mit festen Beispieldaten, ohne Netz und ohne Kontingent.
const { YoutubeError } = require('./youtube.cjs');

const DAY = 86400000;
const CHANNELS = {
  '@meinkanal': { id: 'UCmeinkanal0000000000000', title: 'Mein Tech-Kanal', subs: 12400, base: 3000, short: false },
  '@vorbild': { id: 'UCvorbild00000000000000a', title: 'Großes Vorbild', subs: 1840000, base: 220000, short: false },
  '@shortsprofi': { id: 'UCshortsprofi00000000000', title: 'Shorts Profi', subs: 530000, base: 90000, short: true },
};
const TITLES = [
  'Ich habe 30 Tage nur mit KI gearbeitet',
  'Die versteckte Funktion, die niemand kennt',
  'Warum alle das falsch machen',
  'Vom Anfänger zum Profi in 10 Minuten',
  'Ich teste das billigste Setup',
  'Diese 5 Tools haben alles verändert',
  'Das hat mich wirklich überrascht',
  'So spart man 3 Stunden pro Woche',
  'Ehrliche Meinung nach einem Jahr',
  'Der größte Fehler meiner Karriere',
];

function videosFor(ch) {
  const now = Date.now();
  return TITLES.map((title, i) => {
    const factor = i === 1 ? 6.2 : i === 4 ? 2.7 : 0.7 + ((i * 37) % 7) / 10; // zwei Ausreißer
    const short = ch.short || i % 4 === 3;
    return {
      id: `${ch.id.slice(2, 8)}v${i}`,
      snippet: { title, publishedAt: new Date(now - (i * 4 + 1) * DAY).toISOString(), liveBroadcastContent: 'none', thumbnails: {} },
      contentDetails: { duration: short ? 'PT45S' : `PT${8 + i}M${(i * 7) % 60}S` },
      statistics: { viewCount: String(Math.round(ch.base * factor * (short ? 1.5 : 1))), likeCount: '100', commentCount: '10' },
    };
  });
}

function createFakeYoutubeClient() {
  const byId = (id) => Object.values(CHANNELS).find((c) => c.id === id);
  return {
    async resolveChannel(source) {
      const ch = source.kind === 'id' ? byId(source.value) : CHANNELS[String(source.value).toLowerCase()];
      if (!ch) throw new YoutubeError('Diesen Kanal gibt es auf YouTube nicht (mehr).', 'notFound');
      return {
        id: ch.id,
        snippet: { title: ch.title, customUrl: Object.keys(CHANNELS).find((k) => CHANNELS[k] === ch), description: '', thumbnails: {} },
        statistics: { subscriberCount: String(ch.subs), videoCount: '120', viewCount: '1000000' },
        contentDetails: { relatedPlaylists: { uploads: 'UU' + ch.id.slice(2) } },
      };
    },
    async recentUploadIds(playlist) {
      const ch = byId('UC' + playlist.slice(2));
      return videosFor(ch).map((v) => v.id);
    },
    async videos(ids) {
      const all = Object.values(CHANNELS).flatMap(videosFor);
      return all.filter((v) => ids.includes(v.id));
    },
  };
}

module.exports = { createFakeYoutubeClient };
