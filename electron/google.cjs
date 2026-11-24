// Google-Anmeldung (OAuth 2.0 für Desktop-Apps, Loopback + PKCE) für YouTube Analytics.
// Jeder Benutzer trägt seinen eigenen OAuth-Client (Typ „Desktop-App“) ein – wie beim API-Key.
// Pro verbundenem Kanal wird nur das Refresh-Token gespeichert, verschlüsselt mit safeStorage.
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/yt-analytics.readonly', 'https://www.googleapis.com/auth/youtube.readonly'];
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function createGoogleAuth({ userDataDir, safeStorage, openExternal }) {
  const file = path.join(userDataDir, 'google-auth.json');
  const read = () => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { connections: {} }; }
  };
  const write = (data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  };
  const enc = (s) => safeStorage.encryptString(s).toString('base64');
  const dec = (s) => safeStorage.decryptString(Buffer.from(s, 'base64'));

  // ---- OAuth-Client des Benutzers ----
  function getClient() {
    const d = read();
    if (!d.client?.id || !d.client?.secret) return null;
    try { return { id: d.client.id, secret: dec(d.client.secret) }; } catch { return null; }
  }
  function setClient(id, secret) {
    const d = read();
    if (!id) delete d.client;
    else {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Die Schlüsselablage des Betriebssystems ist nicht verfügbar.');
      if (!/\.apps\.googleusercontent\.com$/.test(id.trim())) throw new Error('Die Client-ID endet normalerweise auf „.apps.googleusercontent.com“.');
      d.client = { id: id.trim(), secret: enc(secret.trim()) };
    }
    write(d);
  }

  function publicView() {
    const d = read();
    return {
      client: d.client ? { set: true, id: d.client.id } : { set: false },
      connections: Object.fromEntries(Object.entries(d.connections || {}).map(([cid, c]) => [cid, { title: c.title, connectedAt: c.connectedAt, error: c.error || null }])),
    };
  }

  // ---- Anmeldung im Browser ----
  let pending = null;
  async function connect() {
    const client = getClient();
    if (!client) throw new Error('Bitte zuerst den Google-OAuth-Client in den Einstellungen eintragen.');
    if (pending) pending.cancel('Neue Anmeldung gestartet.');

    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));

    const { code, redirectUri } = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname !== '/') { res.writeHead(404); return res.end(); }
        const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>YT Hub</title><body style="font:16px system-ui;background:#0f1115;color:#e9ecf2;display:grid;place-items:center;height:100vh;margin:0"><div>${ok ? '✅ Verbunden. Du kannst dieses Fenster schließen und zu YT Hub zurückkehren.' : '⚠ Anmeldung abgebrochen. Du kannst dieses Fenster schließen.'}</div>`);
        finish(ok ? null : new Error(url.searchParams.get('error') === 'access_denied' ? 'Anmeldung abgelehnt.' : 'Anmeldung fehlgeschlagen.'), url.searchParams.get('code'));
      });
      const timer = setTimeout(() => finish(new Error('Zeit für die Anmeldung abgelaufen.')), 5 * 60000);
      const finish = (err, c) => {
        clearTimeout(timer);
        server.close();
        pending = null;
        err ? reject(err) : resolve({ code: c, redirectUri: `http://127.0.0.1:${server.address()?.port ?? port}` });
      };
      let port;
      pending = { cancel: (msg) => finish(new Error(msg)) };
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        const params = new URLSearchParams({
          client_id: client.id,
          redirect_uri: `http://127.0.0.1:${port}`,
          response_type: 'code',
          scope: SCOPES.join(' '),
          code_challenge: challenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent select_account',
          state,
        });
        openExternal(`${AUTH_URL}?${params}`);
      });
    });

    const tokens = await tokenRequest({
      code,
      client_id: client.id,
      client_secret: client.secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    });
    if (!tokens.refresh_token) throw new Error('Google hat kein Refresh-Token geliefert. Bitte die Verbindung unter myaccount.google.com entfernen und erneut verbinden.');

    // Welcher Kanal wurde gewählt?
    const me = await apiGet('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', tokens.access_token);
    const ch = me.items?.[0];
    if (!ch) throw new Error('Mit diesem Google-Konto ist kein YouTube-Kanal verbunden.');
    const d = read();
    d.connections = d.connections || {};
    d.connections[ch.id] = { title: ch.snippet.title, refresh: enc(tokens.refresh_token), connectedAt: new Date().toISOString() };
    write(d);
    cache.set(ch.id, { token: tokens.access_token, until: Date.now() + (tokens.expires_in - 60) * 1000 });
    return { channelId: ch.id, title: ch.snippet.title };
  }

  function disconnect(channelId) {
    const d = read();
    delete d.connections?.[channelId];
    write(d);
    cache.delete(channelId);
  }

  // ---- Zugriffstoken für einen verbundenen Kanal ----
  const cache = new Map();
  async function accessToken(channelId) {
    const hit = cache.get(channelId);
    if (hit && hit.until > Date.now()) return hit.token;
    const d = read();
    const conn = d.connections?.[channelId];
    if (!conn) return null;
    const client = getClient();
    if (!client) throw new Error('Google-OAuth-Client fehlt in den Einstellungen.');
    try {
      const t = await tokenRequest({ client_id: client.id, client_secret: client.secret, refresh_token: dec(conn.refresh), grant_type: 'refresh_token' });
      cache.set(channelId, { token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 });
      if (conn.error) { delete conn.error; write(d); }
      return t.access_token;
    } catch (err) {
      conn.error = err.message;
      write(d);
      throw err;
    }
  }

  return { getClient, setClient, publicView, connect, disconnect, accessToken, isConnected: (id) => !!read().connections?.[id] };
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'invalid_grant') throw new Error('Die Google-Verbindung ist abgelaufen oder wurde widerrufen – bitte neu verbinden.');
    if (data.error === 'invalid_client') throw new Error('Client-ID oder Client-Secret ist falsch.');
    throw new Error(data.error_description || data.error || `Google-Fehler ${res.status}`);
  }
  return data;
}

async function apiGet(url, token) {
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  } catch {
    const e = new Error('Keine Verbindung zu Google.');
    e.reason = 'network';
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error?.message || `Google-API-Fehler ${res.status}`);
    e.status = res.status;
    e.reason = data.error?.errors?.[0]?.reason || data.error?.status;
    throw e;
  }
  return data;
}

module.exports = { createGoogleAuth, apiGet, SCOPES };
