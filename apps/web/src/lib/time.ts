/**
 * Facility time. Every timestamp is stored in UTC and shown in the operator's
 * timezone — one place decides which, so no component hard-codes it.
 */

export const TIMEZONE = "Asia/Kolkata";

/** India has no DST, so IST is a fixed UTC+05:30 offset. */
const IST_OFFSET_MS = 330 * 60_000;

/**
 * The ISO instant for `hh:mm` IST, `days` days after the IST date of `from`.
 * Used for follow-up and callback times ("tomorrow 10:00").
 */
export function istAt(from: number, days: number, hh: number, mm = 0): string {
  const local = new Date(from + IST_OFFSET_MS);
  const utc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, hh, mm);
  return new Date(utc - IST_OFFSET_MS).toISOString();
}

/** The next `hh:mm` IST after `from` — today if it is still ahead, else tomorrow. */
export function nextIst(from: number, hh: number, mm = 0): { iso: string; day: "today" | "tomorrow" } {
  const today = istAt(from, 0, hh, mm);
  return Date.parse(today) > from
    ? { iso: today, day: "today" }
    : { iso: istAt(from, 1, hh, mm), day: "tomorrow" };
}

/** The IST calendar date (YYYY-MM-DD) of an instant. */
export function istDate(at: number): string {
  return new Date(at + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Shared formatters, all in facility time. */
export const formatters = {
  /** 14:07:32 */
  clock: new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }),
  /** 16:00 */
  time: new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }),
  /** Sun 16:00 */
  dayTime: new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }),
  /** Sun 13 Sep, 16:00 */
  dateTime: new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }),
  /** 13 Sep */
  shortDate: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TIMEZONE }),
  /** 16 (hour, 24h) */
  hour24: new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TIMEZONE }),
};
