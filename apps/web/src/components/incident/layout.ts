/**
 * Shared layout constants for the Live Call Theatre.
 *
 * The grid template lives here because the skeleton and the real screen must
 * use identical track sizing — §8 requires the loading state to match the shape
 * of the content that replaces it, and two copies of a track list drift.
 *
 * `minmax(0, 1fr)` rather than a bare `1fr` is deliberate: a `1fr` track has an
 * automatic minimum, so any `truncate` inside it (which sets white-space:
 * nowrap) forces the track wider than its container and pushes a horizontal
 * scrollbar onto the page.
 */
export const THEATRE_GRID = "lg:grid-cols-[340px_minmax(0,1fr)_minmax(340px,1.05fr)]";
