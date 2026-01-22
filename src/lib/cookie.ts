// Cookie Configuration Helper
// ใช้สำหรับ share cookie ระหว่าง bevchat.pro และ chat.bevchat.pro

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  domain?: string;
  path?: string;
}

/**
 * Get cookie domain for cross-subdomain sharing
 * Production: .bevchat.pro (works for bevchat.pro and chat.bevchat.pro)
 * Development: undefined (uses localhost)
 */
export const getCookieDomain = (): string | undefined => {
  if (process.env.NODE_ENV === 'production') {
    return '.bevchat.pro';
  }
  return undefined;
};

/**
 * Get default cookie options for auth token
 */
export const getAuthCookieOptions = (maxAge: number = 7 * 24 * 60 * 60): CookieOptions => {
  const cookieDomain = getCookieDomain();
  
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
    ...(cookieDomain && { domain: cookieDomain })
  };
};

/**
 * Get cookie options for clearing/deleting
 */
export const getClearCookieOptions = (): CookieOptions => {
  return getAuthCookieOptions(0);
};