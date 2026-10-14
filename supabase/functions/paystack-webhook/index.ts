import { createClient } from 'npm:@supabase/supabase-js@2'

// Marks orders paid even if the customer closes the tab right after paying.
Deno.serve(async (req) => {
  const raw = await req.text()
  const supplied = req.headers.get('x-paystack-signature') ?? ''
  if (!/^[a-f0-9]{128}$/i.test(supplied)) return new Response('invalid signature', { status: 401 })
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) return new Response('webhook is not configured', { status: 500 })
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['verify'])
  const signature = new Uint8Array(supplied.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))
  const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(raw))
  if (!valid) return new Response('invalid signature', { status: 401 })
  const ev = JSON.parse(raw)
  if (ev.event === 'charge.success' && ev.data?.status === 'success' && ev.data?.currency === 'NGN') {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: o } = await db.from('orders').select('total,status').eq('reference', ev.data.reference).maybeSingle()
    if (o && o.status === 'pending' && ev.data.amount === o.total * 100) {
      await db.from('orders').update({ status: 'paid' }).eq('reference', ev.data.reference).eq('status', 'pending')
    }
  }
  return new Response('ok')
})
