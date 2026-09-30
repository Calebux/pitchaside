import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/groups', '/players', '/sessions', '/admin', '/settings', '/hq'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Check for auth cookies (HttpOnly cookies are readable in Next.js middleware)
  const accessToken = request.cookies.get('pitchaside_access')?.value;
  const refreshToken = request.cookies.get('pitchaside_refresh')?.value;

  // If neither token exists, redirect to sign in
  if (!accessToken && !refreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/groups/:path*', '/players/:path*', '/sessions/:path*', '/admin/:path*', '/settings/:path*', '/hq/:path*'],
};
