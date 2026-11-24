// Geplante Aufträge: z. B. „jeden Montag um 8 Uhr Ideen für Kanal X recherchieren“.
// Gespeichert in <Datenordner>/auftraege/plaene.json. Läuft, solange YT Hub offen ist;
// was in der Zwischenzeit fällig war, wird beim nächsten Start einmal nachgeholt.
const fs = require('fs');
const path = require('path');

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Nächster Termin strikt nach `after` (lokale Zeit).
function nextOccurrence(plan, after) {
  const d = new Date(after);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(plan.hour);
  if (plan.freq === 'weekly') {
    const diff = (plan.weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    if (d <= after) d.setDate(d.getDate() + 7);
  } else {
    if (d <= after) d.setDate(d.getDate() + 1);
  }
  return d;
}

function describe(plan) {
  const time = `${String(plan.hour).padStart(2, '0')}:00 Uhr`;
  return plan.freq === 'weekly' ? `jeden ${WEEKDAYS[plan.weekday]}, ${time}` : `täglich, ${time}`;
}

function createScheduler({ getDataDir, createJob, onChange }) {
  const file = () => path.join(getDataDir(), 'auftraege', 'plaene.json');
  const read = () => {
    try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return []; }
  };
  const write = (list) => {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(list, null, 2), 'utf8');
    onChange();
  };
  const withNext = (p) => ({ ...p, label: describe(p), nextRun: p.enabled ? nextOccurrence(p, new Date(p.lastRun || p.createdAt)).toISOString() : null });

  function list() {
    return read().map(withNext);
  }

  function save(input) {
    const freq = input.freq === 'daily' ? 'daily' : 'weekly';
    const hour = Math.max(0, Math.min(23, Number(input.hour) || 0));
    const weekday = Math.max(0, Math.min(6, Number(input.weekday) || 0));
    if (!['research', 'learnings', 'profile', 'free'].includes(input.type)) throw new Error('Dieser Auftrag kann nicht geplant werden.');
    if (input.type !== 'free' && !input.channel) throw new Error('Bitte einen Kanal wählen.');
    const all = read();
    const existing = input.id && all.find((p) => p.id === input.id);
    const plan = {
      id: existing?.id || `plan-${Date.now().toString(36)}`,
      type: input.type,
      channel: input.channel || null,
      count: input.count || null,
      note: String(input.note || ''),
      text: String(input.text || ''),
      freq, hour, weekday,
      enabled: input.enabled !== false,
      // Neuer Plan: erster Lauf beim nächsten Termin ab jetzt, nicht rückwirkend.
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastRun: existing ? existing.lastRun : null,
    };
    if (existing && (existing.freq !== freq || existing.hour !== hour || existing.weekday !== weekday)) plan.lastRun = new Date().toISOString();
    write(existing ? all.map((p) => (p.id === plan.id ? plan : p)) : [...all, plan]);
    return list();
  }

  function remove(id) {
    write(read().filter((p) => p.id !== id));
    return list();
  }

  function setEnabled(id, enabled) {
    write(read().map((p) => (p.id === id ? { ...p, enabled, lastRun: enabled ? new Date().toISOString() : p.lastRun } : p)));
    return list();
  }

  async function runNow(id) {
    const plan = read().find((p) => p.id === id);
    if (!plan) throw new Error('Plan nicht gefunden.');
    return start(plan);
  }

  async function start(plan) {
    write(read().map((p) => (p.id === plan.id ? { ...p, lastRun: new Date().toISOString() } : p)));
    return createJob({
      type: plan.type,
      channel: plan.channel,
      count: plan.count,
      note: plan.note,
      text: plan.text,
      mode: 'background',
      scheduled: plan.id,
    });
  }

  // Jede Minute: fällige Pläne starten (verpasste Termine nur einmal nachholen).
  async function tick(now = new Date()) {
    const started = [];
    for (const p of read()) {
      if (!p.enabled) continue;
      const due = nextOccurrence(p, new Date(p.lastRun || p.createdAt));
      if (due <= now) {
        try {
          started.push(await start(p));
        } catch (err) {
          write(read().map((x) => (x.id === p.id ? { ...x, lastRun: now.toISOString(), lastError: err.message } : x)));
        }
      }
    }
    return started;
  }

  return { list, save, remove, setEnabled, runNow, tick };
}

module.exports = { createScheduler, nextOccurrence, describe, WEEKDAYS };
