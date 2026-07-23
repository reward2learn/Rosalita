import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, COOKIE_NAME, type SessionClaims } from '@/lib/auth/jwt';
import { resolvePage, tierAllowsAccess } from '@/lib/page-catalog';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://api.openai.com",
  "font-src 'self' https://fonts.gstatic.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join('; ');

// ── Helpers ────────────────────────────────────────────

function getCookieFromRequest(request: NextRequest, name: string): string | undefined {
  return request.cookies.get(name)?.value;
}

function setSecurityHeaders(response: NextResponse): void {
  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
}

function stripSessionHeaders(headers: Headers): void {
  for (const key of [...headers.keys()]) {
    if (key.toLowerCase().startsWith('x-session-')) {
      headers.delete(key);
    }
  }
}

function injectSessionHeaders(headers: Headers, session: SessionClaims): void {
  headers.set('X-Session-Sub', session.sub);
  headers.set('X-Session-Tier', session.tier);
  if (session.email) headers.set('X-Session-Email', session.email);
  if (session.name) headers.set('X-Session-Name', session.name);
  headers.set('X-Session-Groups', JSON.stringify(session.groups ?? []));
  headers.set('X-Session-Permissions', JSON.stringify(session.permissions ?? []));
  if (session.roleCode) headers.set('X-Session-RoleCode', session.roleCode);
  headers.set('X-Session-PlatformAdmin', session.platformAdmin ? '1' : '0');
  headers.set('X-Session-Verified', '1');
}

// ── Middleware ──────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Phase 5: Rewrites (moved from next.config.mjs)
  if (pathname === '/api/auth/callback/google') {
    const response = NextResponse.rewrite(new URL('/api/auth?action=google-callback', request.url));
    setSecurityHeaders(response);
    return response;
  }
  if (pathname === '/api/monthly-actuals') {
    const response = NextResponse.rewrite(new URL('/api/financial-overview?resource=monthly-actuals', request.url));
    setSecurityHeaders(response);
    return response;
  }
  if (pathname === '/api/pos-scan') {
    const response = NextResponse.rewrite(new URL('/api/pos?action=scan', request.url));
    setSecurityHeaders(response);
    return response;
  }
  if (pathname === '/api/pos-parse') {
    const response = NextResponse.rewrite(new URL('/api/pos?action=parse', request.url));
    setSecurityHeaders(response);
    return response;
  }
  if (pathname === '/api/voice') {
    const response = NextResponse.rewrite(new URL('/api/chat?resource=voice', request.url));
    setSecurityHeaders(response);
    return response;
  }
  if (pathname === '/api/conversations') {
    const response = NextResponse.rewrite(new URL('/api/chat?resource=conversations', request.url));
    setSecurityHeaders(response);
    return response;
  }
  if (pathname === '/api/reports') {
    const response = NextResponse.rewrite(new URL('/api/financial-overview?resource=reports', request.url));
    setSecurityHeaders(response);
    return response;
  }

  // Read session cookie once (used by both Phase 4 and Phase 2)
  const token = getCookieFromRequest(request, COOKIE_NAME);
  let session: SessionClaims | null = null;
  if (token) {
    session = await verifySession(token);
  }

  // Phase 4: Page-level auth gating for non-API, non-NextJS routes
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/')) {
    const slug = pathname.split('/')[1] || 'dashboard';
    const page = resolvePage(slug);
    if (page && !tierAllowsAccess('public', page.authTier)) {
      if (!session) {
        const redirectUrl = new URL('/dashboard', request.url);
        redirectUrl.searchParams.set('redirect_reason', 'auth_required');
        return NextResponse.redirect(redirectUrl);
      }
    }

    const response = NextResponse.next();
    setSecurityHeaders(response);
    return response;
  }

  // Phase 2: API session header injection
  if (pathname.startsWith('/api/')) {
    const headers = new Headers(request.headers);
    // Strip any external X-Session-* headers (security: prevent spoofing)
    stripSessionHeaders(headers);

    if (session) {
      injectSessionHeaders(headers, session);
    }

    const response = NextResponse.next({ request: { headers } });
    setSecurityHeaders(response);
    return response;
  }

  // Fallback (other routes matched by the config matcher)
  const response = NextResponse.next();
  setSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Files with static extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|eot|css|map)$).*)',
  ],
};
