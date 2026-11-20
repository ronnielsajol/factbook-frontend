import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { accessPage } from './lib/access-page';

const cookieName = 'factbook_access';
const seconds = 60 * 60 * 24 * 30;
function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}
function same(left: string, right: string) {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function safePath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://factbook.local');
    return url.origin === 'https://factbook.local' ? url.pathname + url.search + url.hash : '/';
  } catch { return '/'; }
}
export async function proxy(request: NextRequest) {
  const local = !process.env.VERCEL && ['localhost', '127.0.0.1'].includes(request.nextUrl.hostname);
  const secret = process.env.FACTBOOK_SESSION_SECRET;
  if (local && !process.env.FACTBOOK_REQUIRE_ACCESS) return NextResponse.next();
  if (!secret || !process.env.FACTBOOK_API_ORIGIN || !process.env.FACTBOOK_API_KEY) {
    return new Response('Factbook access is not configured.', {status:503, headers:{'Cache-Control':'no-store'}});
  }
  if (request.nextUrl.pathname === '/_factbook/logout') {
    const response = NextResponse.redirect(new URL('/', request.url), 303);
    response.cookies.set(cookieName, '', {path:'/', maxAge:0, httpOnly:true, secure:true, sameSite:'lax'});
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  if (request.nextUrl.pathname === '/_factbook/access' && request.method === 'POST') {
    const form = await request.formData();
    const returnTo = safePath(form.get('returnTo'));
    // Vercel supplies this header. Self-hosted access checks use a shared bucket.
    const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') : 'self-hosted';
    if (!ip) return new Response('Client identity unavailable.', {status:503});
    try {
      const result = await fetch(new URL('/api/factbook/access', process.env.FACTBOOK_API_ORIGIN), {
        method:'POST', cache:'no-store', redirect:'error', signal:AbortSignal.timeout(15000),
        headers:{'Content-Type':'application/json', 'X-Factbook-Key':process.env.FACTBOOK_API_KEY},
        body:JSON.stringify({pin:String(form.get('pin') ?? ''), client:createHmac('sha256', secret).update(ip).digest('hex')}),
      });
      if (result.status === 429) return accessPage(returnTo, 'limited');
      if (result.status === 401) return accessPage(returnTo, 'invalid');
      if (!result.ok || (await result.json()).ok !== true) throw new Error('Access service unavailable');
      const expires = String(Math.floor(Date.now() / 1000) + seconds);
      const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
      response.cookies.set(cookieName, expires + '.' + sign(expires, secret), {path:'/', maxAge:seconds, httpOnly:true, secure:true, sameSite:'lax'});
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch {
      return new Response('Access service unavailable. Please try again.', {status:503, headers:{'Cache-Control':'no-store'}});
    }
  }
  const token = request.cookies.get(cookieName)?.value ?? '';
  const [expires, signature, extra] = token.split('.');
  if (!expires || !signature || extra || !/^\d+$/.test(expires) || Number(expires) <= Date.now()/1000 || !same(signature, sign(expires, secret))) {
    return accessPage(request.nextUrl.pathname + request.nextUrl.search);
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {matcher:['/:path*']};


