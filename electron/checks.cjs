// Prüfungen für die Einstellungsseite: YouTube-Key testen, Claude Code finden.
const { execFile } = require('child_process');

// Kostet 1 Einheit des Tageskontingents.
async function testYoutubeKey(key) {
  if (!key) return { ok: false, status: 'missing', message: 'Kein Key eingetragen.' };
  const url = `https://www.googleapis.com/youtube/v3/i18nLanguages?part=snippet&hl=de&key=${encodeURIComponent(key)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    return { ok: false, status: 'network', message: 'Keine Verbindung zur YouTube-API.' };
  }
  if (res.ok) return { ok: true, status: 'valid', message: 'Key ist gültig.' };

  let reason = '';
  try {
    const body = await res.json();
    reason = body?.error?.errors?.[0]?.reason || body?.error?.status || '';
  } catch {}
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')
    return { ok: false, status: 'quota', message: 'Key ist gültig, aber das Tageskontingent ist aufgebraucht.' };
  if (reason === 'accessNotConfigured' || reason === 'SERVICE_DISABLED')
    return { ok: false, status: 'disabled', message: 'Die „YouTube Data API v3“ ist für dieses Google-Projekt nicht aktiviert.' };
  if (reason === 'ipRefererBlocked' || reason === 'forbidden')
    return { ok: false, status: 'restricted', message: 'Der Key ist eingeschränkt und darf von hier nicht genutzt werden.' };
  return { ok: false, status: 'invalid', message: 'Key ist ungültig.' };
}

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      resolve(err ? null : String(stdout).trim());
    });
  });
}

async function findClaude() {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const found = await run(finder, ['claude']);
  if (!found) return { found: false };
  const exe = found.split(/\r?\n/)[0].trim();
  const version = await run(exe, ['--version']);
  return { found: true, path: exe, version: version || null };
}

module.exports = { testYoutubeKey, findClaude };
