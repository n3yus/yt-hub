import React, { useState } from 'react';
import { ClaudeSection, DataDirSection, YoutubeKeySection } from './Settings.jsx';

const STEPS = [
  { title: 'Datenordner', Section: DataDirSection },
  { title: 'YouTube-API-Key', Section: YoutubeKeySection, optional: true },
  { title: 'Claude Code', Section: ClaudeSection },
];

export default function Welcome({ settings, onSettings, onDone }) {
  const [step, setStep] = useState(-1);

  const finish = async () => {
    await window.ythub.updateSettings({ setupDone: true });
    window.location.hash = '/';
    onDone();
  };

  if (step === -1) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <div className="brand big">
            <span className="brand-mark">▶</span>
            <span>YT Hub</span>
          </div>
          <h1>Willkommen</h1>
          <p className="muted">
            Behalte deine YouTube-Kanäle und deine Vorbilder im Blick, sammle Videoideen und lass Claude Code für dich
            recherchieren und Skripte schreiben.
          </p>
          <p className="muted">Drei kurze Schritte, dann geht es los. Alles lässt sich später in den Einstellungen ändern.</p>
          <div className="dialog-actions">
            <button className="btn ghost" onClick={finish}>Überspringen</button>
            <button className="btn primary" onClick={() => setStep(0)}>Einrichten</button>
          </div>
        </div>
      </div>
    );
  }

  const { title, Section, optional } = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="welcome">
      <div className="welcome-card wide">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className={i === step ? 'on' : i < step ? 'done' : ''}>
              <span>{i < step ? '✓' : i + 1}</span> {s.title}
            </li>
          ))}
        </ol>
        <Section settings={settings} onSettings={onSettings} />
        <div className="dialog-actions">
          <button className="btn ghost" onClick={() => setStep(step - 1)}>Zurück</button>
          {optional && !settings.youtubeKey.set && (
            <button className="btn ghost" onClick={() => setStep(step + 1)}>Später</button>
          )}
          <button className="btn primary" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? 'Fertig' : 'Weiter'}
          </button>
        </div>
        <p className="muted small center">Schritt {step + 1} von {STEPS.length}: {title}</p>
      </div>
    </div>
  );
}
