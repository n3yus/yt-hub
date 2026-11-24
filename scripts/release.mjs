// Veröffentlicht die aktuelle Version als GitHub-Release – Schritt für Schritt statt parallel,
// damit nie eine Datei fehlt oder latest.yml nicht zum Installer passt.
//
//   node scripts/release.mjs            bauen, prüfen, hochladen
//   node scripts/release.mjs --dry-run  nur bauen und prüfen
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { version } = pkg;
const { owner, repo } = pkg.build.publish;
const tag = `v${version}`;
const dryRun = process.argv.includes('--dry-run');

const ghCandidates = ['gh', 'C:\\Program Files\\GitHub CLI\\gh.exe'];
const gh = ghCandidates.find((c) => spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0);
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' && !cmd.includes('\\'), ...opts });
const out = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();
const fail = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1); };
const step = (msg) => console.log(`\n▶ ${msg}`);

// 1. Vorbedingungen
if (!gh && !dryRun) fail('GitHub CLI (gh) nicht gefunden.');
if (out('git', ['status', '--porcelain'])) fail('Es gibt nicht committete Änderungen. Erst committen.');
if (!dryRun) {
  const remoteTag = out('git', ['ls-remote', '--tags', 'origin', tag]);
  if (!remoteTag) fail(`Tag ${tag} fehlt auf GitHub. Erst: git tag ${tag}; git push; git push origin ${tag}`);
  const exists = spawnSync(gh, ['release', 'view', tag, '--repo', `${owner}/${repo}`], { stdio: 'ignore' }).status === 0;
  if (exists) fail(`Release ${tag} gibt es schon. Version in package.json erhöhen.`);
}

// 2. Bauen (ohne Veröffentlichen)
step(`Baue ${version}`);
run('npx', ['vite', 'build']);
run('npx', ['electron-builder', '--win', '--publish', 'never']);

// 3. Prüfen: latest.yml muss zum frisch gebauten Installer passen
step('Prüfe Dateien');
const rel = path.join(root, 'release');
const exe = path.join(rel, `${pkg.build.productName || pkg.productName} Setup ${version}.exe`);
const blockmap = `${exe}.blockmap`;
const latest = path.join(rel, 'latest.yml');
for (const f of [exe, blockmap, latest]) if (!fs.existsSync(f)) fail(`Datei fehlt: ${f}`);
const yml = fs.readFileSync(latest, 'utf8');
const sha = createHash('sha512').update(fs.readFileSync(exe)).digest('base64');
if (!yml.includes(`version: ${version}`)) fail('latest.yml hat eine falsche Version.');
if (!yml.includes(sha)) fail('Die Prüfsumme in latest.yml passt nicht zum Installer.');
if (!yml.includes(`size: ${fs.statSync(exe).size}`)) fail('Die Größe in latest.yml passt nicht zum Installer.');
console.log('  latest.yml passt zum Installer ✓');
if (dryRun) {
  console.log('\n✔ Probelauf fertig – nichts hochgeladen.');
  process.exit(0);
}

// 4. Hochladen: Dateinamen so, wie latest.yml sie erwartet (Leerzeichen → Bindestriche)
step(`Erstelle Release ${tag} und lade hoch`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ythub-release-'));
const assetName = `${(pkg.build.productName || pkg.productName).replace(/ /g, '-')}-Setup-${version}.exe`;
const files = [
  [exe, assetName],
  [blockmap, `${assetName}.blockmap`],
  [latest, 'latest.yml'],
].map(([src, name]) => {
  const dest = path.join(tmp, name);
  fs.copyFileSync(src, dest);
  return dest;
});
run(gh, ['release', 'create', tag, '--repo', `${owner}/${repo}`, '--title', version, '--notes', `YT Hub ${version} – Installer für Windows. Installierte Versionen aktualisieren sich automatisch.`, ...files], { shell: false });
fs.rmSync(tmp, { recursive: true, force: true });

// 5. Kontrolle
step('Kontrolliere Release');
const assets = JSON.parse(out(gh, ['release', 'view', tag, '--repo', `${owner}/${repo}`, '--json', 'assets'])).assets.map((a) => a.name);
for (const name of [assetName, `${assetName}.blockmap`, 'latest.yml']) if (!assets.includes(name)) fail(`Im Release fehlt: ${name}`);
console.log(`\n✔ Release ${tag} veröffentlicht: https://github.com/${owner}/${repo}/releases/tag/${tag}`);
