import { NextResponse } from 'next/server';

/**
 * Bảo vệ route dashboard: yêu cầu cookie accessToken (set khi đăng nhập).
 * Đáp ứng yêu cầu Next.js middleware — INT1334.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;

  if (pathname.startsWith('/dashboard')) {
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === '/login' && accessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
