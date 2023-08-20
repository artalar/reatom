import { next } from '@vercel/edge'
import { kv } from '@vercel/kv'

export default async function middleware(req: Request): Promise<Response> {
  const headers: ResponseInit['headers'] = {}
  if (
    req.headers.get('accept')?.includes('text/html') &&
    new URL(req.url).origin.endsWith('reatom.dev')
  ) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const count = await kv.incr(today.toISOString()).catch(() => 0)
    headers['x-visit-count'] = count.toString()
  }
  return next({ headers })
}
