// Test-only: answers the ERP client's fetch from a table of path prefixes
// (longest match wins) and records every call. Unmatched paths answer 404.

export type Seen = { url: URL; init?: RequestInit };

export function mockErp(routes: Record<string, (s: Seen) => unknown | Promise<unknown>>) {
  process.env.ERP_URL = 'http://uniform.localhost:8000';
  process.env.ERP_READ_KEY = 'reader:secret';
  process.env.ERP_WRITE_KEY = 'portal:secret';
  const seen: Seen[] = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const s = { url, init };
    seen.push(s);
    const key = keys.find((k) => decodeURIComponent(url.pathname).startsWith(k));
    if (!key) return new Response('{}', { status: 404 });
    const out = await routes[key](s);
    return out instanceof Response ? out : new Response(JSON.stringify(out), { status: 200 });
  }) as typeof fetch;
  return { seen, posts: () => seen.filter((x) => x.init?.method === 'POST') };
}
