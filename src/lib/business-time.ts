// Single-shop deployment, business runs on IST (UTC+5:30) with no DST.
// Day-boundary queries anchor here instead of UTC so "today" matches the
// calendar day the shop actually experiences - without this, a sale made
// between midnight and 5:30am IST gets stamped with the previous UTC
// calendar date and silently drops out of "today"'s window.
export const BUSINESS_TZ_OFFSET = "+05:30";

export function businessDayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000${BUSINESS_TZ_OFFSET}`);
}

export function businessDayEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999${BUSINESS_TZ_OFFSET}`);
}
