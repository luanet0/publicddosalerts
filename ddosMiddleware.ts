import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export const config = {
  matcher: '/:path*',
}

const DISCORD_WEBHOOK =
  'https://discord.com/api/webhooks/1453097509353291787/_1OgzXJOC8JceP8fYb_gaXtign77ICuTl0A_zXEzdtv6tzEaOKv0GpPD72xMqCTxfnpz'

const IP_LIMIT = 100
const GLOBAL_LIMIT = 400
const WINDOW = 10

export async function ddosMiddleware(req: NextRequest) {
  const ip =
    req.ip ||
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown'

  const ipKey = `ddos:ip:${ip}`
  const globalKey = `ddos:global:${Math.floor(Date.now() / (WINDOW * 1000))}`

  const ipCount = await kv.incr(ipKey)
  await kv.expire(ipKey, WINDOW)

  const globalCount = await kv.incr(globalKey)
  await kv.expire(globalKey, WINDOW)

  if (ipCount > IP_LIMIT || globalCount > GLOBAL_LIMIT) {
    const logged = await kv.get<boolean>('ddos:active')
    await kv.set('ddos:active', true, { ex: WINDOW })

    if (!logged) {
      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: '🚨 Traffic Flood Detected',
              color: 16711680,
              fields: [
                { name: 'IP', value: ip, inline: true },
                { name: 'Path', value: req.nextUrl.pathname, inline: true },
                { name: 'IP Requests', value: String(ipCount), inline: true },
                { name: 'Global Requests', value: String(globalCount), inline: true },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      })
    }

    return new NextResponse('Rate Limited', { status: 429 })
  }

  return NextResponse.next()
}
