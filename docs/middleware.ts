import { next, geolocation } from '@vercel/edge'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qratowognuwxoywxegcs.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY as string
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (
    url.origin.endsWith('reatom.dev') &&
    req.headers.get('accept')?.includes('text/html')
  ) {
    try {
      await supabase.from('logs').insert({
        created_at: new Date().toISOString(),
        path: url.pathname,
        country: geolocation(req).country,
      })
    } catch (error) {
      console.error(error)
    }
  }

  return next()
}
