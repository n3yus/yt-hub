// Schlanker Client für die YouTube Data API v3. Zählt verbrauchte Einheiten pro Tag
// (das Kontingent wird um Mitternacht pazifischer Zeit zurückgesetzt).
const fs = require('fs');
const path = require('path');

const API = 'https://www.googleapis.com/youtube/v3';
const DAILY_QUOTA = 10000;
const COST = { channels: 1, playlistItems: 1, videos: 1, search: 100 };

class YoutubeError extends Error {
  constructor(message, reason, status) {
    super(message);
    this.reason = reason;
    this.status = status;
  }
}

function pacificDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(date);
}

function createQuotaCounter(userDataDir) {
  const file = path.join(userDataDir, 'quota.json');
  const read = () => {
    try {
      const q = JSON.parse(fs.readFileSync(file, 'utf8'));
      return q.day === pacificDay() ? q : { day: pacificDay(), used: 0 };
    } catch {
      return { day: pacificDay(), used: 0 };
    }
  };
  return {
    add(units) {
      const q = read();
      q.used += units;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(q), 'utf8');
    },
    get() {
      const q = read();
      return { day: q.day, used: q.used, limit: DAILY_QUOTA };
    },
  };
}

function createYoutubeClient({ getKey, quota }) {
  async function call(endpoint, params) {
    const key = getKey();
    if (!key) throw new YoutubeError('Kein YouTube-API-Key eingetragen.', 'noKey');
    const qs = new URLSearchParams({ ...params, key });
    let res;
    try {
      res = await fetch(`${API}/${endpoint}?${qs}`, { signal: AbortSignal.timeout(15000) });
    } catch {
      throw new YoutubeError('Keine Verbindung zur YouTube-API.', 'network');
    }
    quota.add(COST[endpoint] || 1);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = body?.error?.errors?.[0]?.reason || '';
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')
        throw new YoutubeError('Das YouTube-Tageskontingent ist aufgebraucht – morgen geht es weiter.', 'quota', res.status);
      if (reason === 'keyInvalid' || (res.status === 400 && /API key/i.test(body?.error?.message || '')))
        throw new YoutubeError('Der YouTube-API-Key ist ungültig.', 'keyInvalid', res.status);
      if (reason === 'playlistNotFound') throw new YoutubeError('Für diesen Kanal gibt es keine Upload-Liste.', reason, res.status);
      throw new YoutubeError(body?.error?.message || `YouTube-API-Fehler ${res.status}`, reason, res.status);
    }
    return body;
  }

  // Findet einen Kanal über Handle, ID, Benutzername oder (teuer) die Suche.
  async function resolveChannel(source) {
    const part = 'snippet,statistics,contentDetails';
    let params;
    if (source.kind === 'id') params = { part, id: source.value };
    else if (source.kind === 'handle') params = { part, forHandle: source.value };
    else if (source.kind === 'user') params = { part, forUsername: source.value };

    let item;
    if (params) {
      item = (await call('channels', params)).items?.[0];
    }
    if (!item && (source.kind === 'custom' || source.kind === 'user')) {
      // Alte /c/-Links lassen sich nur über die Suche auflösen (100 Einheiten).
      const hit = (await call('search', { part: 'snippet', type: 'channel', q: source.value, maxResults: 1 })).items?.[0];
      if (hit) item = (await call('channels', { part, id: hit.snippet.channelId })).items?.[0];
    }
    if (!item) throw new YoutubeError('Diesen Kanal gibt es auf YouTube nicht (mehr).', 'notFound');
    return item;
  }

  async function recentUploadIds(uploadsPlaylistId, max = 50) {
    const res = await call('playlistItems', { part: 'contentDetails', playlistId: uploadsPlaylistId, maxResults: Math.min(max, 50) });
    return (res.items || []).map((i) => i.contentDetails.videoId);
  }

  async function videos(ids) {
    if (!ids.length) return [];
    const res = await call('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(','), maxResults: 50 });
    return res.items || [];
  }

  return { resolveChannel, recentUploadIds, videos };
}

module.exports = { createYoutubeClient, createQuotaCounter, YoutubeError, DAILY_QUOTA };
