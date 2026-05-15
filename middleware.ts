import createMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './src/i18n/routing';

const intlMiddleware = createMiddleware(routing);
const protectedRoutes = new Set(['reminders', 'glucose']);

export default async function middleware(request: NextRequest) {
  const protectedPath = getProtectedPath(request.nextUrl.pathname);
  if (!protectedPath) {
    return intlMiddleware(request);
  }

  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
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
