import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

export const stripFrontmatter = (text) => String(text || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

// Claude schreibt Inhalte aus dem Web – deshalb wird jedes HTML bereinigt.
export function renderMarkdown(md) {
  return DOMPurify.sanitize(marked.parse(md || ''), { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button'] });
}

// Links in gerendertem Markdown im Browser öffnen, nie im App-Fenster.
export function onMarkdownClick(e) {
  const a = e.target.closest && e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href') || '';
  if (/^https:\/\//i.test(href)) window.ythub.openExternal(href).catch(() => {});
}

export default function Markdown({ text, className = '' }) {
  const html = useMemo(() => renderMarkdown(stripFrontmatter(text)), [text]);
  return <div className={'md ' + className} onClick={onMarkdownClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
