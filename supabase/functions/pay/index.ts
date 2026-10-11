import { createClient } from 'npm:@supabase/supabase-js@2'
import { menu, FEE, FREE_OVER, MAX_QTY } from '../_shared/menu.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const paystack = (path: string, init: RequestInit = {}) =>
  fetch('https://api.paystack.co' + path, { ...init, headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`, 'Content-Type': 'application/json' } }).then((r) => r.json())

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await db.auth.getUser((req.headers.get('Authorization') ?? '').replace('Bearer ', ''))
    if (!user) return json({ error: 'Log in first.' }, 401)
    const body = await req.json()

    if (['merchant-check', 'merchant-list', 'merchant-update'].includes(body.action)) {
      const { data: staff, error: staffError } = await db
        .from('restaurant_staff')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      if (staffError) throw staffError
      if (body.action === 'merchant-check') return json({ staff: Boolean(staff), role: staff?.role ?? null })
      if (!staff) return json({ error: 'Restaurant staff access is required.' }, 403)

      if (body.action === 'merchant-list') {
        const { data, error } = await db
          .from('orders')
          .select('id,reference,items,total,status,name,phone,address,created_at,fulfillment_status')
          .in('status', ['paid', 'cod'])
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error
        return json({ orders: data ?? [] })
      }

      const nextStatus: Record<string, string> = {
        received: 'preparing',
        preparing: 'ready',
        ready: 'out_for_delivery',
        out_for_delivery: 'delivered',
      }
      const { data: order, error: orderError } = await db
        .from('orders')
        .select('id,status,fulfillment_status')
        .eq('id', body.order_id)
        .maybeSingle()
      if (orderError) throw orderError
      if (!order) return json({ error: 'Order not found.' }, 404)
      if (!['paid', 'cod'].includes(order.status)) return json({ error: 'This order is not ready for fulfillment.' }, 409)
      if (nextStatus[order.fulfillment_status] !== body.fulfillment_status) {
        return json({ error: 'That is not the next valid order status.' }, 409)
      }

      const { data: updated, error: updateError } = await db
        .from('orders')
        .update({ fulfillment_status: body.fulfillment_status })
        .eq('id', order.id)
        .select('id,reference,items,total,status,name,phone,address,created_at,fulfillment_status')
        .single()
      if (updateError) throw updateError
      return json({ order: updated })
    }

    if (body.action === 'init') {
      // Prices come from the server-side menu, never from the browser.
      // deno-lint-ignore no-explicit-any
      const items: any[] = (body.items ?? [])
        .map((i: { id: number; qty: number }) => ({ ...menu.find((m) => m.id === i.id), qty: Math.min(MAX_QTY, Math.max(1, i.qty | 0)) }))
        .filter((i: { price?: number }) => i.price)
      if (!items.length) return json({ error: 'Your cart is empty.' }, 400)
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
      const total = subtotal + (subtotal < FREE_OVER ? FEE : 0)
      const cod = body.pay === 'cash'
      const reference = 'CD' + Date.now().toString(36).toUpperCase() + crypto.randomUUID().slice(0, 4)
      const { error } = await db.from('orders').insert({
        reference, user_id: user.id, total, status: cod ? 'cod' : 'pending',
        items: items.map((i) => ({ id: i.id, name: i.name, qty: i.qty })),
        name: String(body.name ?? '').slice(0, 80), phone: String(body.phone ?? '').slice(0, 20), address: String(body.address ?? '').slice(0, 300),
      })
      if (error) throw error
      if (cod) return json({ reference })
      const r = await paystack('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email: user.email, amount: total * 100, currency: 'NGN', reference }) })
      if (!r.status) throw new Error(r.message)
      return json({ reference, access_code: r.data.access_code })
    }

    if (body.action === 'verify') {
      const { data: order } = await db.from('orders').select('id,total').eq('reference', body.reference).eq('user_id', user.id).maybeSingle()
      if (!order) return json({ error: 'Order not found.' }, 404)
      const r = await paystack('/transaction/verify/' + encodeURIComponent(body.reference))
      const paid = r.status && r.data.status === 'success' && r.data.amount === order.total * 100 && r.data.currency === 'NGN'
      if (paid) await db.from('orders').update({ status: 'paid' }).eq('id', order.id)
      return json({ paid })
    }
    return json({ error: 'Unknown action.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Something went wrong.' }, 500)
  }
})
