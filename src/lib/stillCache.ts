/**
 * Still thumbs / plates are named uniquely (thumb_*, plate_*, take_*).
 * no-store forced every scroll to re-download through the function —
 * private day cache keeps the same URL on the phone without sharing
 * across users.
 */
export const STILL_CACHE_CONTROL =
  "private, max-age=86400, stale-while-revalidate=604800";
