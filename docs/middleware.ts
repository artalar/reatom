import { next } from '@vercel/edge'
import { kv } from '@vercel/kv'

const IS_DEV = process.env.VERCEL_ENV === 'development'

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const shouldLog =
    req.headers.get('accept')?.includes('text/html') &&
    (url.origin.endsWith('reatom.dev') || IS_DEV)

  if (shouldLog) {
    try {
      const today = new Date()
      today.setUTCMilliseconds(0)
      today.setUTCSeconds(0)
      today.setUTCMilliseconds(0)
      today.setUTCHours(0)

      console.time('kv.incr')
      await kv.incr(today.toUTCString())
      console.timeEnd('kv.incr')
    } catch (error) {
      console.error(error)
    }
  }

  return next()
}
