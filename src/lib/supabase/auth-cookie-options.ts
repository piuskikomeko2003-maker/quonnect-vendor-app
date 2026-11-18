/**
 * Auth cookies must not be marked `secure` during local development: browsers
 * silently drop secure cookies on plain `http://192.168.x.x`, which is exactly
 * how a tablet reaches the dev server over Wi-Fi.
 *
 * Only mark them secure in a production build served over HTTPS. Capacitor
 * (`capacitor://localhost`) therefore stays non-secure, while `https://localhost`
 * and normal HTTPS deployments do get secure cookies.
 */
export function shouldUseSecureAuthCookies(isHttps: boolean): boolean {
  return process.env.NODE_ENV === "production" && isHttps;
}

export function authCookieOptions(isHttps: boolean): { secure: boolean } {
  return { secure: shouldUseSecureAuthCookies(isHttps) };
}
