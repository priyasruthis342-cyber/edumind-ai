import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'scan'; course: string }
  | { name: 'theory' }
  | { name: 'study'; scanId: string | null }
  | { name: 'progress' };

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const segments = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);

  switch (segments[0]) {
    case 'scan':
      return { name: 'scan', course: params.get('course') ?? '' };
    case 'theory':
      return { name: 'theory' };
    case 'study':
      return { name: 'study', scanId: segments[1] ?? null };
    case 'progress':
      return { name: 'progress' };
    default:
      return { name: 'home' };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const handleChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', handleChange);
    return () => window.removeEventListener('hashchange', handleChange);
  }, []);

  return route;
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function studyPath(scanId: string): string {
  return `/study/${scanId}`;
}

export function scanPath(course = ''): string {
  return course ? `/scan?course=${encodeURIComponent(course)}` : '/scan';
}
