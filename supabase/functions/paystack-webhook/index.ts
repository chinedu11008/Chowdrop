import { createClient } from 'npm:@supabase/supabase-js@2'

// Marks orders paid even if the customer closes the tab right after paying.
Deno.serve(async (req) => {
  const raw = await req.text()
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('PAYSTACK_SECRET_KEY')!), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))).map((b) => b.toString(16).padStart(2, '0')).join('')
  if (sig !== req.headers.get('x-paystack-signature')) return new Response('invalid signature', { status: 401 })
  const ev = JSON.parse(raw)
  if (ev.event === 'charge.success') {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: o } = await db.from('orders').select('total').eq('reference', ev.data.reference).maybeSingle()
    if (o && ev.data.amount === o.total * 100) await db.from('orders').update({ status: 'paid' }).eq('reference', ev.data.reference)
  }
  return new Response('ok')
})
