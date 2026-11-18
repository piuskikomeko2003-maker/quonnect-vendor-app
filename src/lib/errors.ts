/**
 * Converts database, network and library errors into short messages that make
 * sense to a vendor. Raw SQL, PostgREST and Supabase details never reach the
 * screen.
 */
type ErrorLike =
  | string
  | null
  | undefined
  | {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };

interface ErrorRule {
  pattern: RegExp;
  message: string;
}

const RULES: ErrorRule[] = [
  {
    pattern: /jwt|session.*expired|invalid refresh token|refresh token.*not found|auth session missing/i,
    message: "Your session has expired. Please sign in again.",
  },
  {
    pattern: /failed to fetch|networkerror|network request failed|fetch failed|load failed|offline|err_internet/i,
    message: "Can't reach the server. Check your internet connection and try again.",
  },
  {
    pattern: /duplicate key|unique constraint|\b23505\b/i,
    message: "This record already exists. Refresh the page and try again.",
  },
  {
    pattern: /row-level security|permission denied|insufficient privilege|\b42501\b/i,
    message: "You don't have permission to do that. Please sign in again and retry.",
  },
  {
    pattern: /relation .* does not exist|could not find the table|schema cache|\bPGRST205\b|\b42P01\b/i,
    message: "This feature isn't set up yet. Apply the latest database update and try again.",
  },
  {
    pattern: /column .* does not exist|could not find the .* column|\bPGRST204\b|\b42703\b/i,
    message: "This feature isn't set up yet. Apply the latest database update and try again.",
  },
  {
    pattern: /foreign key|\b23503\b/i,
    message: "This record is linked to other data, so it can't be changed right now.",
  },
  {
    pattern: /check constraint|violates check|\b23514\b/i,
    message: "Some details aren't valid. Check the form and try again.",
  },
  {
    pattern: /not-null|null value in column|\b23502\b/i,
    message: "Some required details are missing. Check the form and try again.",
  },
  {
    pattern: /numeric field overflow|out of range|\b22003\b/i,
    message: "That amount is too large. Enter a smaller number.",
  },
  {
    pattern: /invalid input syntax|invalid text representation|\b22P02\b/i,
    message: "Some details aren't valid. Refresh the page and try again.",
  },
  {
    pattern: /value too long|\b22001\b/i,
    message: "That text is too long. Shorten it and try again.",
  },
  {
    pattern: /deadlock|lock timeout|\b40001\b|\b57014\b/i,
    message: "The server was busy. Wait a moment and try again.",
  },
];

/** Markers that mean a message is an implementation detail, not user copy. */
const TECHNICAL = /(pgrst|sqlstate|violates|constraint|relation |schema|postgrest|supabase|row-level|\b\d{5}\b|typeerror|stack trace|error:|internal|0x[0-9a-f]+)/i;

export function userMessage(
  error: ErrorLike,
  fallback = "Something went wrong. Please try again.",
): string {
  const code =
    typeof error === "object" && error !== null && error.code != null
      ? String(error.code)
      : "";
  const raw =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null
        ? String(error.message ?? error.details ?? error.hint ?? "")
        : "";
  const trimmed = raw.replace(/^error:\s*/i, "").trim();
  const haystack = `${code} ${trimmed}`;

  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.message;
  }

  if (!trimmed) return fallback;

  // Messages raised by our own RPCs are written for vendors. Keep those, but
  // never echo anything that still looks like a database or runtime error.
  if (TECHNICAL.test(trimmed)) return fallback;
  if (trimmed.length > 180) return fallback;

  return trimmed;
}

/** Small helper for server actions that need an optional error shape. */
export function friendlyError(
  error: unknown,
  fallback?: string,
): { ok: false; error: string } {
  const value =
    error instanceof Error || typeof error === "string" || error === null
      ? (error as ErrorLike)
      : typeof error === "object"
        ? (error as ErrorLike)
        : String(error);
  return { ok: false, error: userMessage(value, fallback) };
}
