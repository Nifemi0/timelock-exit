import { span, time } from '../lib/format'

interface RailProps {
  /** Unix seconds. Omit `queuedAt` to draw the empty rail. */
  queuedAt?: number
  executesAt?: number
  exitAt?: number
  now: number
  /** What the queued change does, shown at the execution mark. */
  effect?: string
  /** A matching change is queued and the exit has not confirmed yet. */
  inFlight?: boolean
}

const START = 24
const EXECUTE = 1128
const END = 1248
const BASE = 104
const label = { fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: 0.9 } as const

/** The timelock window drawn as a ruler: queued, your exit, now, and the moment the change executes. */
export function Rail({ queuedAt, executesAt, exitAt, now, effect, inFlight }: RailProps) {
  const ticks = (
    <>
      <defs>
        <pattern id="rail-ticks" width="24" height="10" patternUnits="userSpaceOnUse">
          <rect width="1" height="10" fill="#3a3a3a" />
        </pattern>
      </defs>
      <rect x={START} y={BASE} width={END - START} height="10" fill="url(#rail-ticks)" />
      <line x1={START} y1={BASE} x2={END} y2={BASE} stroke="#3a3a3a" strokeWidth="1" />
    </>
  )

  if (queuedAt === undefined || executesAt === undefined) {
    return (
      <svg viewBox="0 0 1272 178" role="img" aria-label="Timelock window: nothing is queued">
        {ticks}
        <text x={START} y="138" fill="#555" {...label}>
          NOTHING QUEUED
        </text>
      </svg>
    )
  }

  const total = Math.max(1, executesAt - queuedAt)
  const at = (t: number) => Math.min(END, START + (Math.max(0, t - queuedAt) / total) * (EXECUTE - START))

  // Keep the exit mark clear of the queued mark, and "now" clear of the exit, so a
  // three-second exit on a five-minute delay is still legible.
  const exitX = exitAt !== undefined ? Math.max(at(exitAt), START + 40) : undefined
  const nowX = Math.max(at(now), exitX !== undefined ? exitX + 30 : START)
  const executed = now >= executesAt
  const nowLabelX = Math.max(nowX, START + 110)

  const summary =
    exitAt !== undefined
      ? `Timelock window: change queued at ${time(queuedAt)}, your exit ${exitAt - queuedAt} seconds later, change executes at ${time(executesAt)}`
      : `Timelock window: change queued at ${time(queuedAt)}, executes at ${time(executesAt)}`

  return (
    <svg viewBox="0 0 1272 178" role="img" aria-label={summary}>
      {ticks}
      <line x1={START} y1={BASE} x2={nowX} y2={BASE} stroke="#fff" strokeWidth="2" />

      {exitX !== undefined && exitAt !== undefined && (
        <>
          <line x1={exitX} y1="52" x2={EXECUTE} y2="52" stroke="#2F6BFF" strokeWidth="1" />
          <line x1={exitX} y1="46" x2={exitX} y2={BASE} stroke="#2F6BFF" strokeWidth="1" />
          <line x1={EXECUTE} y1="46" x2={EXECUTE} y2="58" stroke="#2F6BFF" strokeWidth="1" />
          <rect x="494" y="42" width="204" height="20" fill="#000" />
          <text x="596" y="56" fill="#2F6BFF" textAnchor="middle" {...label}>
            CLEAR BY {span(executesAt - exitAt)}
          </text>
          <rect x={exitX - 6} y={BASE - 6} width="12" height="12" fill="#2F6BFF" />
          <text x={exitX} y="32" fill="#fff" {...label}>
            [ YOU EXITED +{exitAt - queuedAt}S ]
          </text>
        </>
      )}

      {inFlight && exitX === undefined && (
        <>
          <rect className="blink" x={START + 34} y={BASE - 6} width="12" height="12" fill="#2F6BFF" />
          <text x={START + 40} y="32" fill="#2F6BFF" {...label}>
            [ EXIT IN FLIGHT ]
          </text>
        </>
      )}

      <rect x={START - 5} y={BASE - 5} width="10" height="10" fill="#000" stroke="#8C8C8C" strokeWidth="1.5" />
      <text x={START} y="138" fill="#8C8C8C" {...label}>
        QUEUED
      </text>
      <text x={START} y="156" fill="#555" {...label}>
        {time(queuedAt)}
      </text>

      {!executed && (
        <>
          <rect x={nowX - 5} y={BASE - 5} width="10" height="10" fill="#fff" />
          {nowLabelX < EXECUTE - 110 && (
            <text x={nowLabelX} y="138" fill="#fff" textAnchor="middle" {...label}>
              NOW
            </text>
          )}
        </>
      )}

      <line x1={EXECUTE} y1="70" x2={EXECUTE} y2="124" stroke="#FF4A1C" strokeWidth="2" />
      <rect x={EXECUTE} y={BASE} width={END - EXECUTE} height="10" fill="#FF4A1C" fillOpacity={executed ? 0.7 : 0.28} />
      <text x={EXECUTE} y="138" fill="#FF4A1C" textAnchor="middle" {...label}>
        [ {(effect ?? 'CHANGE').toUpperCase()} {executed ? 'EXECUTABLE' : 'LIVE'} ]
      </text>
      <text x={EXECUTE} y="156" fill="#555" textAnchor="middle" {...label}>
        {time(executesAt)}
      </text>
    </svg>
  )
}
