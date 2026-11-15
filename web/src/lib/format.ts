import { formatUnits } from 'viem'

/** 0x1234…abcd */
export function short(value: string, edge = 4): string {
  return value.length <= 2 + edge * 2 ? value : `${value.slice(0, 2 + edge)}…${value.slice(-edge)}`
}

/** Token amount with two decimals and thousands separators. */
export function amount(value: bigint, decimals: number): string {
  return Number(formatUnits(value, decimals)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const two = (n: number) => String(n).padStart(2, '0')

/** Seconds as mm:ss, or h:mm:ss past an hour. Never negative. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`
}

/** Seconds as "04 MIN 57 SEC" for rail labels. */
export function span(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${two(h)} HR ${two(m)} MIN` : `${two(m)} MIN ${two(s % 60)} SEC`
}

/** Short human duration: 3 sec, 4 min, 2 hr. */
export function duration(seconds: number): { value: string; unit: string } {
  const s = Math.max(0, Math.round(seconds))
  if (s < 120) return { value: String(s), unit: 'sec' }
  if (s < 7200) return { value: String(Math.round(s / 60)), unit: 'min' }
  return { value: String(Math.round(s / 3600)), unit: 'hr' }
}

/** Unix seconds as HH:MM:SS UTC. */
export function time(unix: number): string {
  const d = new Date(unix * 1000)
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`
}

/** Unix seconds as "14 Nov, 12:04 UTC". */
export function stamp(unix: number): string {
  const d = new Date(unix * 1000)
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${d.getUTCDate()} ${month}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`
}
