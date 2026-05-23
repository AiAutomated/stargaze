/**
 * Time Utilities
 * Conversion between JavaScript dates and Julian Dates for astronomical calculations
 */

/**
 * Convert JavaScript Date to Julian Date
 * Reference: https://en.wikipedia.org/wiki/Julian_day
 *
 * @param date JavaScript Date object
 * @returns Julian Date (number)
 */
export function dateToJulianDate(date: Date): number {
  const a = Math.floor((14 - (date.getUTCMonth() + 1)) / 12)
  const y = date.getUTCFullYear() + 4800 - a
  const m = (date.getUTCMonth() + 1) + 12 * a - 3

  const jdn =
    date.getUTCDate() +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045

  // Add fractional day
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000
  return jdn + (hours - 12) / 24
}

/**
 * Convert Julian Date to JavaScript Date
 *
 * @param jd Julian Date (number)
 * @returns JavaScript Date object
 */
export function julianDateToDate(jd: number): Date {
  const a = Math.floor(jd + 0.5) + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)

  const day = e - Math.floor((153 * m + 2) / 5) + 1
  const month = m + 3 - 12 * Math.floor(m / 10)
  const year = 100 * b + d - 4800 + Math.floor(m / 10)

  const frac = jd + 0.5 - Math.floor(jd + 0.5)
  const hours = frac * 24
  const h = Math.floor(hours)
  const minutes = (hours - h) * 60
  const min = Math.floor(minutes)
  const seconds = (minutes - min) * 60
  const sec = Math.floor(seconds)
  const ms = Math.floor((seconds - sec) * 1000)

  return new Date(Date.UTC(year, month - 1, day, h, min, sec, ms))
}

/**
 * Get current Julian Date
 *
 * @returns Current Julian Date
 */
export function getCurrentJulianDate(): number {
  return dateToJulianDate(new Date())
}

/**
 * Format Julian Date as human-readable string
 *
 * @param jd Julian Date
 * @returns Formatted date string (YYYY-MM-DD HH:MM:SS UTC)
 */
export function formatJulianDate(jd: number): string {
  const date = julianDateToDate(jd)
  return date.toUTCString()
}
