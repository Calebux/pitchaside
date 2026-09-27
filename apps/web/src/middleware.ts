import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/groups', '/players', '/sessions', '/admin'];
const publicPaths = ['/', '/signin', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path is protected
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // In middleware we can't access localStorage, so we check for a cookie
  // The auth state is primarily managed client-side via localStorage
  // This middleware provides a lightweight server-side check
  const token = request.cookies.get('pitchaside_token')?.value;

  // If no cookie, still allow — client-side AuthProvider will handle redirect
  // This avoids blocking on first load when token is only in localStorage
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/groups/:path*', '/players/:path*', '/sessions/:path*', '/admin/:path*'],
};
