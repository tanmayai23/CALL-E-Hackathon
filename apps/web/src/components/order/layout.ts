/**
 * Shared layout constants for the Live Call Theatre.
 *
 * The grid template lives here because the skeleton and the real screen must
 * use identical track sizing — §8 requires the loading state to match the shape
 * of the content that replaces it, and two copies of a track list drift.
 *
 * Three pinned columns need the width of an xl screen: with the sidebar, a
 * 1024px viewport leaves the middle track under 100px. Below xl the theatre is
 * two columns — the order beside the reasoning, the conversation full width
 * beneath them — and the page scrolls instead of pinning.
 *
 * `minmax(0, 1fr)` rather than a bare `1fr` is deliberate: a `1fr` track has an
 * automatic minimum, so any `truncate` inside it (which sets white-space:
 * nowrap) forces the track wider than its container and pushes a horizontal
 * scrollbar onto the page. The same holds on a phone, which is why the single
 * column is declared (`grid-cols-1` is `minmax(0, 1fr)`) rather than implicit.
 */
export const THEATRE_GRID =
  "grid-cols-1 md:grid-cols-2 xl:grid-cols-[340px_minmax(0,1fr)_minmax(340px,1.05fr)]";

/** The conversation column: full width in the two-column layout, one track at xl. */
export const THEATRE_WIDE = "md:col-span-2 xl:col-span-1";
