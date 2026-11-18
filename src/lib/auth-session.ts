import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { markSignedIn, markSignedOut } from "@/lib/auth-marker";

/**
 * One shared session lookup for the whole browser session.
 *
 * `/`, `/login` and `VendorProvider` all need to know whether a session
 * exists. Each used to call `supabase.auth.getSession()` separately, which can
 * trigger a token refresh over the network. Caching the promise means the
 * first caller pays the cost and the rest reuse the result across client-side
 * navigations. Supabase auth events invalidate the cache automatically.
 */

type CachedSession = { session: Session | null };

let cached: CachedSession | null = null;
let inflight: Promise<Session | null> | null = null;
let listening = false;

/** Treat a token expiring within a minute as stale so callers can refresh. */
function isFresh(session: Session | null): boolean {
  if (!session) return true;
  if (!session.expires_at) return true;
  return session.expires_at * 1000 - Date.now() > 60_000;
}

function startListening() {
  if (listening) return;
  listening = true;

  createClient().auth.onAuthStateChange((_event, session) => {
    cached = { session };
    if (session) markSignedIn();
    else markSignedOut();
  });
}

export function clearSessionCache() {
  cached = null;
  inflight = null;
}

/**
 * Returns the current session, reusing an in-flight or recent lookup.
 * Pass `force` after an explicit auth action when the cache must be bypassed.
 */
export function getSessionOnce(options: { force?: boolean } = {}): Promise<Session | null> {
  startListening();

  if (!options.force && cached && isFresh(cached.session)) {
    return Promise.resolve(cached.session);
  }

  if (inflight) return inflight;

  inflight = createClient()
    .auth.getSession()
    .then(({ data }) => {
      cached = { session: data.session };
      if (data.session) markSignedIn();
      else markSignedOut();
      return data.session;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
