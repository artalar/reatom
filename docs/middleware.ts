import { next } from '@vercel/edge'
import { kv } from '@vercel/kv'
import { waitUntil } from '@vercel/functions'

export default async function middleware(req: Request) {
  if (req.headers.get('accept')?.includes('text/html')) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    waitUntil(kv.incr(today.toISOString()))
  }
  return next()
}
