/**
 * Cached proxy for Blockscout's log API (Vercel function, served at /api/logs).
 *
 * Blockscout's free API rate-limits each visitor, and the app polls, so several people
 * viewing the site at once would get HTTP 429 and an empty history. Routing through here
 * lets Vercel's edge cache serve everyone the same response, so Blockscout sees at most
 * one request per address every few seconds.
 *
 * Only the project's own contracts are served, so this cannot be used as an open proxy.
 */

const UPSTREAM = 'https://base-sepolia.blockscout.com/api'
const FROM_BLOCK = process.env.VITE_FROM_BLOCK || '59288000'

const allowed = new Set(
  [process.env.VITE_EXIT_GUARD, process.env.VITE_TIMELOCK]
    .filter((a): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a))
    .map(a => a.toLowerCase()),
)

function json(body: unknown, status: number, cache: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': cache },
  })
}

async function fetchUpstream(address: string): Promise<Response> {
  const url = `${UPSTREAM}?module=logs&action=getLogs&fromBlock=${FROM_BLOCK}&toBlock=latest&address=${address}`
  let res = await fetch(url)
  if (res.status === 429) {
    await new Promise(resolve => setTimeout(resolve, 1200))
    res = await fetch(url)
  }
  return res
}

export async function GET(request: Request): Promise<Response> {
  const address = new URL(request.url).searchParams.get('address')?.toLowerCase() ?? ''
  if (!allowed.has(address)) {
    return json({ status: '0', message: 'Unknown address', result: [] }, 400, 'no-store')
  }

  try {
    const res = await fetchUpstream(address)
    const body = (await res.json()) as { status?: string; message?: string }
    const ok = res.ok && (body.status === '1' || /no records/i.test(body.message ?? ''))
    if (!ok) {
      return json({ status: '0', message: body.message ?? `Upstream ${res.status}`, result: [] }, 503, 'no-store')
    }
    // Fresh for 10 s at the edge; serve the last good copy for up to a day while refreshing.
    return json(body, 200, 'public, s-maxage=10, stale-while-revalidate=86400')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream error'
    return json({ status: '0', message, result: [] }, 503, 'no-store')
  }
}
