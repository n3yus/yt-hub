import { useEffect, useState } from 'react';

const current = () => window.location.hash.replace(/^#/, '') || '/';

// Liefert den Pfad ohne Query, z. B. "/feed" für "#/feed?channel=x".
export function useHashRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const on = () => setRoute(current());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route.split('?')[0];
}

export function hashQuery() {
  const q = current().split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

export const go = (route) => {
  window.location.hash = route;
};
