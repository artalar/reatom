import { next, geolocation } from '@vercel/edge'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qratowognuwxoywxegcs.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY as string
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

const log = async (req: Request) => {
  try {
    const requestData = {
      created_at: new Date().toISOString(),
      path: req.url,
      country: geolocation(req).country,
    }

    await supabase.from('logs').insert(requestData)
  } catch (error) {
    console.error(error)
  }
}

export default async function middleware(req: Request): Promise<Response> {
  if (req.headers.get('accept')?.includes('text/html')) {
    await log(req)
  }

  return next()
}
