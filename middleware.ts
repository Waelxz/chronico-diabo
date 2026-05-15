import createMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './src/i18n/routing';

const intlMiddleware = createMiddleware(routing);
const protectedRoutes = new Set(['reminders', 'glucose']);
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

export default async function middleware(request: NextRequest) {
  const protectedPath = getProtectedPath(request.nextUrl.pathname);
  if (!protectedPath) {
    return intlMiddleware(request);
  }

  const token = authSecret
    ? await getToken({
        req: request,
        secret: authSecret,
        secureCookie: isSecureRequest(request),
      })
    : null;
  if (token) {
    return intlMiddleware(request);
  }

  const loginUrl = new URL(`/${protectedPath.locale}/login`, request.url);
  loginUrl.searchParams.set(
    'callbackUrl',
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };

function getProtectedPath(pathname: string): { locale: string } | null {
  const segments = pathname.split('/').filter(Boolean);
  const maybeLocale = segments[0];
  const maybeRoute = segments[1];
  const hasLocale = routing.locales.includes(maybeLocale as 'fr' | 'ar');
  const route = hasLocale ? maybeRoute : maybeLocale;

  if (!protectedRoutes.has(route)) return null;

  return {
    locale: hasLocale ? maybeLocale : routing.defaultLocale,
  };
}

function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.split(',')[0]?.trim() === 'https';
  }

  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (authUrl) {
    return authUrl.startsWith('https://');
  }

  return request.nextUrl.protocol === 'https:';
}
