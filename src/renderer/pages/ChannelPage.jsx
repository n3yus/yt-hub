import React, { useCallback, useEffect, useState } from 'react';
import { go, hashQuery } from '../router.js';
import { compact } from '../format.js';
import { openJobDialog } from '../jobDialog.js';
import IdeaBoard from '../components/IdeaBoard.jsx';
import ScriptList from '../components/ScriptList.jsx';
import DocPanel from '../components/DocPanel.jsx';
import Markdown from '../markdown.jsx';

const TABS_OWN = [
  ['ideen', 'Ideen'],
  ['skripte', 'Skripte'],
  ['profil', 'Profil'],
  ['recherche', 'Recherche'],
];
const TABS_WATCH = [
  ['profil', 'Profil'],
  ['ideen', 'Ideen'],
  ['recherche', 'Recherche'],
];

export default function ChannelPage({ slug, dataVersion }) {
  const [channel, setChannel] = useState(null);
  const [missing, setMissing] = useState(false);
  const own = channel?.type === 'own';
  const tabs = own ? TABS_OWN : TABS_WATCH;
  const [tab, setTab] = useState(hashQuery().tab || null);

  useEffect(() => {
    window.ythub.listChannels().then((list) => {
      const c = list.find((x) => x.slug === slug);
      if (!c) setMissing(true);
      setChannel(c || null);
    });
  }, [slug, dataVersion]);

  // Links wie „#/kanal/x?tab=skripte“ auch dann anwenden, wenn die Seite schon offen ist.
  useEffect(() => {
    const on = () => setTab(hashQuery().tab || null);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const active = tab && tabs.find((t) => t[0] === tab) ? tab : tabs[0][0];
  const switchTab = (t) => {
    setTab(t);
    window.history.replaceState(null, '', `#/kanal/${slug}?tab=${t}`);
  };

  if (missing) {
    return (
      <div className="page">
        <p className="muted">Diesen Kanal gibt es nicht mehr.</p>
        <button className="btn" onClick={() => go('/')}>Zu den Kanälen</button>
      </div>
    );
  }
  if (!channel) return null;

  return (
    <div className="page wide">
      <button className="back" onClick={() => go('/')}>← Kanäle</button>
      <header className="channel-head">
        {channel.thumbnail ? (
          <img className="avatar big img" src={channel.thumbnail} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className={'avatar big' + (own ? ' own' : '')}>{channel.name.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="channel-head-main">
          <h1>{channel.name}</h1>
          <div className="muted small channel-head-meta">
            <span className={'tag' + (own ? ' own' : '')}>{own ? 'Eigener Kanal' : 'Beobachtet'}</span>
            {channel.handle && <button className="link" onClick={() => window.ythub.openExternal(channel.url)}>{channel.handle}</button>}
            {channel.stats && <span>{compact(channel.stats.subscribers)} Abos · {compact(channel.stats.videos)} Videos</span>}
          </div>
        </div>
        <div className="channel-head-actions">
          {own && <button className="btn primary" onClick={() => openJobDialog({ type: 'research', channel: slug })}>💡 Ideen recherchieren</button>}
          {!own && <button className="btn" onClick={() => go(`/feed?channel=${slug}`)}>Videos im Feed</button>}
          <button className="btn ghost" onClick={() => window.ythub.openChannelFolder(slug)}>Ordner</button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={'tab' + (active === id ? ' on' : '')} onClick={() => switchTab(id)}>
            {label}
            {id === 'ideen' && channel.counts.ideas > 0 && <span className="count">{channel.counts.ideas}</span>}
            {id === 'skripte' && channel.counts.scripts > 0 && <span className="count">{channel.counts.scripts}</span>}
          </button>
        ))}
      </nav>

      {active === 'ideen' && <IdeaBoard slug={slug} own={own} dataVersion={dataVersion} />}
      {active === 'skripte' && <ScriptList slug={slug} dataVersion={dataVersion} />}
      {active === 'profil' && <ProfileTab channel={channel} dataVersion={dataVersion} />}
      {active === 'recherche' && <ResearchTab slug={slug} own={own} dataVersion={dataVersion} />}
    </div>
  );
}

function ProfileTab({ channel, dataVersion }) {
  const own = channel.type === 'own';
  return (
    <div className="profile-grid">
      <DocPanel slug={channel.slug} rel="channel.md" title="Kanal-Profil" dataVersion={dataVersion}
        empty="Noch kein Profil."
        action={<button className="btn small" onClick={() => openJobDialog({ type: 'profile', channel: channel.slug })}>🪪 Von Claude entwerfen lassen</button>} />
      {own && (
        <DocPanel slug={channel.slug} rel="style-guide.md" title="Style-Guide" dataVersion={dataVersion}
          empty="Noch kein Style-Guide – Claude legt ihn beim Kanal-Profil mit an." />
      )}
    </div>
  );
}

function ResearchTab({ slug, own, dataVersion }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => window.ythub.research(slug).then((l) => { setList(l); setOpen((o) => o || l[0]?.file || null); }), [slug]);
  useEffect(() => { load(); }, [load, dataVersion]);
  if (!list) return null;
  if (!list.length) {
    return (
      <div className="empty small-empty">
        <p className="muted">Noch keine Recherche-Berichte.</p>
        {own && <button className="btn primary" onClick={() => openJobDialog({ type: 'research', channel: slug })}>Ideen recherchieren lassen</button>}
      </div>
    );
  }
  return (
    <div className="split">
      <div className="split-list">
        {list.map((r) => (
          <button key={r.file} className={'list-item' + (open === r.file ? ' on' : '')} onClick={() => setOpen(r.file)}>
            <strong>{r.title}</strong>
            <span className="muted small">{r.file.replace('research/', '').slice(0, 10)}</span>
          </button>
        ))}
      </div>
      {open && <DocView slug={slug} rel={open} dataVersion={dataVersion} />}
    </div>
  );
}

function DocView({ slug, rel, dataVersion }) {
  const [doc, setDoc] = useState(null);
  useEffect(() => { window.ythub.readDoc(slug, rel).then(setDoc); }, [slug, rel, dataVersion]);
  if (!doc) return null;
  return (
    <div className="panel doc">
      <div className="row end"><button className="btn ghost small" onClick={() => window.ythub.openDoc(slug, rel)}>Datei öffnen</button></div>
      <Markdown text={doc.text} />
    </div>
  );
}
