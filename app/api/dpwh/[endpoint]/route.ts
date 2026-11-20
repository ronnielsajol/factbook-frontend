export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ endpoint: string }> }) {
  const { endpoint } = await context.params;
  const origin = process.env.FACTBOOK_API_ORIGIN;
  try {
    if (!origin) throw new Error('Missing API origin');
    const url = new URL('/api/dpwh/' + encodeURIComponent(endpoint), origin);
    url.search = new URL(request.url).search;
    const upstream = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Factbook-Key': process.env.FACTBOOK_API_KEY || '' },
      cache: 'no-store', redirect: 'error', signal: request.signal,
    });
    const headers = new Headers();
    for (const name of ['content-type', 'cache-control', 'x-content-type-options']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: 'The project database is not available yet.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
function unsupported() {
  return Response.json({ error: 'Only GET is supported.' }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
}
export { unsupported as POST, unsupported as PUT, unsupported as PATCH, unsupported as DELETE, unsupported as HEAD, unsupported as OPTIONS };

