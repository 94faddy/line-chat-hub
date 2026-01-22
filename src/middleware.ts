import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Domain Configuration
const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'https://bevchat.pro';
const CHAT_DOMAIN = process.env.NEXT_PUBLIC_CHAT_DOMAIN || 'https://chat.bevchat.pro';

// Extract domain from URL
const MAIN_HOST = new URL(MAIN_DOMAIN).host;
const CHAT_HOST = new URL(CHAT_DOMAIN).host;

export function middleware(request: NextRequest) {
  const { pathname, host } = request.nextUrl;
  
  // Get the actual host (handle both production and development)
  const currentHost = host || request.headers.get('host') || '';
  
  // Check if we're on the chat subdomain
  const isChatDomain = currentHost.includes('chat.') || currentHost === CHAT_HOST;
  
  // Check if we're on the main domain
  const isMainDomain = !isChatDomain && (currentHost.includes(MAIN_HOST) || currentHost === MAIN_HOST);

  // ========================================
  // Route: chat.bevchat.pro
  // Only allow: /inbox, /api, /auth, /_next, static files
  // ========================================
  if (isChatDomain) {
    // Root path on chat domain -> redirect to /inbox
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/inbox', request.url));
    }
    
    // Allow inbox and related paths
    if (pathname.startsWith('/inbox') || 
        pathname.startsWith('/api') || 
        pathname.startsWith('/auth') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/uploads') ||
        pathname.includes('.')) {
      return NextResponse.next();
    }
    
    // Dashboard paths on chat domain -> redirect to main domain
    if (pathname.startsWith('/dashboard')) {
      const mainUrl = new URL(pathname, MAIN_DOMAIN);
      mainUrl.search = request.nextUrl.search;
      return NextResponse.redirect(mainUrl);
    }
    
    // Any other path on chat domain -> redirect to /inbox
    return NextResponse.redirect(new URL('/inbox', request.url));
  }

  // ========================================
  // Route: bevchat.pro (Main Domain)
  // Allow all paths except /inbox (redirect to chat domain)
  // ========================================
  if (isMainDomain) {
    // Inbox on main domain -> redirect to chat domain
    if (pathname.startsWith('/inbox')) {
      const chatUrl = new URL(pathname, CHAT_DOMAIN);
      chatUrl.search = request.nextUrl.search;
      return NextResponse.redirect(chatUrl);
    }
    
    // Root path on main domain -> redirect to dashboard
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Allow all other paths
    return NextResponse.next();
  }

  // ========================================
  // Development / Local Environment
  // Allow all paths
  // ========================================
  return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};