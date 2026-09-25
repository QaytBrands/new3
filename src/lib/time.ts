/**
 * Time-zone helpers. All timestamps are stored as UTC instants; "today", day boundaries and
 * review due dates are computed in the relevant user's IANA time zone.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

const DAY_MS = 86_400_000;

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Falls back to the default zone for missing/invalid values so rendering never throws. */
export function safeTimeZone(tz: string | null | undefined): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const zones = intl.supportedValuesOf?.("timeZone") ?? [DEFAULT_TIMEZONE, "UTC"];
  return zones.includes("UTC") ? zones : [...zones, "UTC"];
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, tz: string): Parts {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const { type, value } of f.formatToParts(date)) if (type !== "literal") p[type] = Number(value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Calendar date ("YYYY-MM-DD") of `date` in `tz`. */
export function zonedDayKey(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** UTC instant of local midnight for a calendar date in `tz` (DST-safe). */
function midnightOf(year: number, month: number, day: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let t = guess - offsetMs(new Date(guess), tz);
  // Re-evaluate once in case the offset differs at the actual instant (DST transitions).
  const corrected = guess - offsetMs(new Date(t), tz);
  if (corrected !== t) t = corrected;
  return new Date(t);
}

/** Start of the local day containing `date`, shifted by `addDays` calendar days. */
export function startOfZonedDay(date: Date, tz: string, addDays = 0): Date {
  const p = zonedParts(date, tz);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays));
  return midnightOf(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), tz);
}

/** [start, end) of the local day containing `now`. */
export function zonedDayRange(now: Date, tz: string): { start: Date; end: Date } {
  return { start: startOfZonedDay(now, tz), end: startOfZonedDay(now, tz, 1) };
}

/** Calendar keys of the last `n` local days ending today, oldest first. */
export function lastZonedDayKeys(now: Date, tz: string, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(zonedDayKey(startOfZonedDay(now, tz, -i), tz));
  return keys;
}

/** Whole local calendar days between two instants (b − a) in `tz`. */
export function zonedDaysBetween(a: Date, b: Date, tz: string): number {
  return Math.round((startOfZonedDay(b, tz).getTime() - startOfZonedDay(a, tz).getTime()) / DAY_MS);
}

export function formatDate(date: Date | null | undefined, tz: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: safeTimeZone(tz), day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(date: Date | null | undefined, tz: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimeZone(tz),
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
