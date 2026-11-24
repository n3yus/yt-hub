import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ago, compact, duration, score } from '../format.js';
import { go, hashQuery } from '../router.js';
import { openJobDialog } from '../jobDialog.js';

const PERIODS = [
  { id: '7', label: '7 Tage', days: 7 },
  { id: '30', label: '30 Tage', days: 30 },
  { id: 'all', label: 'Alle', days: null },
];

export default function Feed({ settings, onSettings, sync }) {
  const initial = useMemo(hashQuery, []);
  const [videos, setVideos] = useState(null);
  const [channels, setChannels] = useState([]);
  const [onlyOutliers, setOnlyOutliers] = useState(initial.outliers === '1');
  const [format, setFormat] = useState('all');
  const [channel, setChannel] = useState(initial.channel || 'all');
  const [period, setPeriod] = useState('30');
  const [includeOwn, setIncludeOwn] = useState(false);

  // „Neu“ = seit dem letzten Besuch des Feeds erschienen. Den alten Zeitpunkt merken, dann aktualisieren.
  const seenBefore = useRef(settings.lastFeedVisit);
  useEffect(() => {
    window.ythub.updateSettings({ lastFeedVisit: new Date().toISOString() }).then(onSettings);
  }, []);

  // Links wie „#/feed?channel=x“ auch dann anwenden, wenn der Feed schon offen ist.
  useEffect(() => {
    const on = () => {
      const q = hashQuery();
      setChannel(q.channel || 'all');
      setOnlyOutliers(q.outliers === '1');
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const types = includeOwn ? ['watch', 'own'] : ['watch'];
    window.ythub.listFeed({ types }).then(setVideos);
    window.ythub.listChannels().then(setChannels);
  }, [sync.version, includeOwn]);

  const watched = channels.filter((c) => c.type === 'watch');
  const shown = useMemo(() => {
    if (!videos) return [];
    const days = PERIODS.find((p) => p.id === period).days;
    const since = days ? Date.now() - days * 86400000 : 0;
    return videos.filter(
      (v) =>
        (!onlyOutliers || v.outlier) &&
        (format === 'all' || (format === 'short' ? v.isShort : !v.isShort)) &&
        (channel === 'all' || v.channel.slug === channel) &&
        new Date(v.publishedAt).getTime() >= since
    );
  }, [videos, onlyOutliers, format, channel, period]);

  const outlierCount = (videos || []).filter((v) => v.outlier).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Feed</h1>
          <p className="muted">Neue Videos der beobachteten Kanäle. 🔥 = läuft deutlich besser als üblich für diesen Kanal.</p>
        </div>
        <button className="btn ghost" disabled={!settings.youtubeKey.set || sync.status?.running} onClick={() => window.ythub.syncChannels()}>
          {sync.status?.running ? 'Aktualisiere …' : '↻ Aktualisieren'}
        </button>
      </header>

      {!settings.youtubeKey.set && (
        <div className="notice">
          <span>Für den Feed braucht YT Hub deinen YouTube-API-Key.</span>
          <button className="btn ghost small" onClick={() => go('/settings')}>Zu den Einstellungen</button>
        </div>
      )}
      {sync.status?.error && !sync.status.running && <div className="notice error">{sync.status.error}</div>}

      {channels.length > 0 && watched.length === 0 && !includeOwn ? (
        <div className="empty">
          <h2>Noch keine beobachteten Kanäle</h2>
          <p className="muted">Füge Kanäle mit der Art „Beobachten“ hinzu, um ihre neuen Videos hier zu sehen.</p>
          <button className="btn primary" onClick={() => go('/')}>Zu den Kanälen</button>
        </div>
      ) : (
        <>
          <div className="filters">
            <div className="chips">
              <button className={'chip' + (!onlyOutliers ? ' on' : '')} onClick={() => setOnlyOutliers(false)}>Alle Videos</button>
              <button className={'chip' + (onlyOutliers ? ' on' : '')} onClick={() => setOnlyOutliers(true)}>
                🔥 Nur Ausreißer {outlierCount > 0 && <span className="count">{outlierCount}</span>}
              </button>
            </div>
            <div className="chips">
              {[['all', 'Alle Formate'], ['long', 'Lange Videos'], ['short', 'Shorts']].map(([id, label]) => (
                <button key={id} className={'chip' + (format === id ? ' on' : '')} onClick={() => setFormat(id)}>{label}</button>
              ))}
            </div>
            <div className="chips">
              {PERIODS.map((p) => (
                <button key={p.id} className={'chip' + (period === p.id ? ' on' : '')} onClick={() => setPeriod(p.id)}>{p.label}</button>
              ))}
            </div>
            <select className="filter-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="all">Alle Kanäle</option>
              {channels
                .filter((c) => includeOwn || c.type === 'watch')
                .map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={includeOwn} onChange={(e) => setIncludeOwn(e.target.checked)} /> eigene Kanäle zeigen
            </label>
          </div>

          {videos && shown.length === 0 && (
            <div className="empty small-empty">
              <p className="muted">
                {videos.length === 0
                  ? 'Noch keine Videos geladen. Klicke auf „Aktualisieren“.'
                  : 'Keine Videos für diese Filter.'}
              </p>
            </div>
          )}

          <div className="video-grid">
            {shown.map((v) => (
              <VideoCard key={v.id} video={v} isNew={seenBefore.current && v.publishedAt > seenBefore.current} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VideoCard({ video: v, isNew }) {
  const url = v.isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`;
  const ideaFromVideo = () =>
    openJobDialog({
      type: 'from-video',
      video: { id: v.id, title: v.title, url, views: v.views, score: v.score, publishedAt: v.publishedAt, thumbnail: v.thumbnail, channelName: v.channel.name, channelSlug: v.channel.slug },
    });
  const open = () => window.ythub.openExternal(v.isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`);
  return (
    <article className={'video' + (v.outlier ? ' is-outlier' : '')}>
      <button className="thumb" onClick={open} title="Auf YouTube ansehen">
        {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="thumb-empty" />}
        {v.durationSec > 0 && <span className="badge dur">{v.isShort ? 'Short' : duration(v.durationSec)}</span>}
        {v.outlier && (
          <span className={'badge score' + (v.outlier === 'strong' ? ' strong' : '')} title="Aufrufe im Vergleich zum Median des Kanals">
            🔥 {score(v.score)}
          </span>
        )}
        {isNew && <span className="badge new">neu</span>}
      </button>
      <div className="video-body">
        <h3 className="video-title" title={v.title}>{v.title}</h3>
        <div className="video-meta">
          <button className="link muted" onClick={() => go(`/feed?channel=${v.channel.slug}`)}>{v.channel.name}</button>
        </div>
        <div className="video-meta muted">
          <span>{compact(v.views)} Aufrufe</span>
          <span>·</span>
          <span>{ago(v.publishedAt)}</span>
          {v.score !== null && v.score !== undefined && !v.outlier && (
            <>
              <span>·</span>
              <span title="Aufrufe im Vergleich zum Median des Kanals">{score(v.score)}</span>
            </>
          )}
          {v.young && v.outlier && <span title="Jünger als 3 Tage – Wert kann sich noch ändern">· frisch</span>}
        </div>
        {v.channel.type === 'watch' && (
          <button className="idea-btn" onClick={ideaFromVideo} title="Claude leitet daraus eine Idee für deinen Kanal ab">
            💡 Idee daraus
          </button>
        )}
      </div>
    </article>
  );
}
