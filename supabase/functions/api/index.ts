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
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request body.' }, 400)

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
        const page = Number.isInteger(body.page) ? Math.min(10000, Math.max(0, body.page)) : 0
        const pageSize = 50
        const from = page * pageSize
        let query = db
          .from('orders')
          .select('id,reference,items,total,status,name,phone,address,created_at,fulfillment_status', { count: 'exact' })
          .in('status', ['paid', 'cod'])
          .order('created_at', { ascending: false })
        if (staff.role === 'staff') query = query.neq('fulfillment_status', 'delivered')
        const { data, error, count } = await query.range(from, from + pageSize - 1)
        if (error) throw error
        return json({ orders: data ?? [], page, total: count ?? 0, has_more: from + (data?.length ?? 0) < (count ?? 0), role: staff.role })
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
        .eq('fulfillment_status', order.fulfillment_status)
        .select('id,reference,items,total,status,name,phone,address,created_at,fulfillment_status')
        .maybeSingle()
      if (updateError) throw updateError
      if (!updated) return json({ error: 'Another staff member changed this order. Refresh and try again.' }, 409)
      return json({ order: updated })
    }

    if (body.action === 'init') {
      if (body.pay !== 'card' && body.pay !== 'cash') return json({ error: 'Choose a valid payment method.' }, 400)

      const checkoutId = typeof body.checkout_id === 'string' ? body.checkout_id : ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutId)) {
        return json({ error: 'This checkout has expired. Refresh the page and try again.' }, 400)
      }

      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
      const address = typeof body.address === 'string' ? body.address.trim() : ''
      const phoneDigits = phone.replace(/\D/g, '').length
      if (name.length < 2 || name.length > 80) return json({ error: 'Enter a name between 2 and 80 characters.' }, 400)
      if (phone.length > 20 || !/^\+?[\d\s-]+$/.test(phone) || phoneDigits < 7 || phoneDigits > 15) {
        return json({ error: 'Enter a valid phone number.' }, 400)
      }
      if (address.length < 8 || address.length > 300) return json({ error: 'Enter an address between 8 and 300 characters.' }, 400)
      if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > menu.length) {
        return json({ error: 'Add valid menu items before checkout.' }, 400)
      }

      // Rebuild every line from the server-side menu and reject malformed quantities.
      const quantities = new Map<number, number>()
      for (const raw of body.items as unknown[]) {
        if (!raw || typeof raw !== 'object') return json({ error: 'One or more menu items are invalid.' }, 400)
        const line = raw as { id?: unknown; qty?: unknown }
        if (typeof line.id !== 'number' || !Number.isSafeInteger(line.id) || typeof line.qty !== 'number' || !Number.isSafeInteger(line.qty) || line.qty < 1) {
          return json({ error: 'One or more item quantities are invalid.' }, 400)
        }
        const product = menu.find((item) => item.id === line.id)
        if (!product) return json({ error: 'One or more menu items are no longer available.' }, 400)
        const quantity = (quantities.get(product.id) ?? 0) + line.qty
        if (quantity > MAX_QTY) return json({ error: `You can order up to ${MAX_QTY} of each item.` }, 400)
        quantities.set(product.id, quantity)
      }
      const items = [...quantities].map(([id, qty]) => ({ ...menu.find((item) => item.id === id)!, qty }))
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
      const total = subtotal + (subtotal < FREE_OVER ? FEE : 0)
      const cod = body.pay === 'cash'
      const reference = 'CD' + Date.now().toString(36).toUpperCase() + crypto.randomUUID().slice(0, 4)
      const { data: rows, error } = await db.rpc('create_order_for_checkout', {
        p_reference: reference,
        p_user_id: user.id,
        p_checkout_id: checkoutId,
        p_items: items.map((item) => ({ id: item.id, name: item.name, qty: item.qty, unit_price: item.price })),
        p_total: total,
        p_name: name,
        p_phone: phone,
        p_address: address,
        p_is_cod: cod,
      })
      if (error?.code === 'P0001') return json({ error: error.message }, 429)
      if (error?.code === '22023') return json({ error: error.message }, 409)
      if (error) throw error
      const order = Array.isArray(rows) ? rows[0] : null
      if (!order) throw new Error('The order could not be created.')
      if (order.order_status === 'paid') return json({ reference: order.order_reference, paid: true })
      if (cod) return json({ reference: order.order_reference })
      if (order.access_code) return json({ reference: order.order_reference, access_code: order.access_code })
      if (!order.created) return json({ error: 'Checkout is already starting. Try again in a moment.' }, 409)

      try {
        const r = await paystack('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email: user.email, amount: total * 100, currency: 'NGN', reference: order.order_reference }) })
        if (!r.status || typeof r.data?.access_code !== 'string') throw new Error(r.message || 'Paystack could not start this payment.')
        const { error: saveError } = await db.from('orders')
          .update({ paystack_access_code: r.data.access_code })
          .eq('id', order.order_id)
          .eq('status', 'pending')
        if (saveError) throw saveError
        return json({ reference: order.order_reference, access_code: r.data.access_code })
      } catch (error) {
        // A failed init must not strand this idempotency key with a dead order.
        await db.from('orders').delete().eq('id', order.order_id).eq('status', 'pending').is('paystack_access_code', null)
        throw error
      }
    }

    if (body.action === 'verify') {
      const { data: order } = await db.from('orders').select('id,total,status').eq('reference', body.reference).eq('user_id', user.id).maybeSingle()
      if (!order) return json({ error: 'Order not found.' }, 404)
      if (order.status === 'paid') return json({ paid: true })
      if (order.status !== 'pending') return json({ paid: false })
      const r = await paystack('/transaction/verify/' + encodeURIComponent(body.reference))
      const paid = r.status && r.data.status === 'success' && r.data.reference === body.reference && r.data.amount === order.total * 100 && r.data.currency === 'NGN'
      if (paid) await db.from('orders').update({ status: 'paid' }).eq('id', order.id).eq('status', 'pending')
      return json({ paid })
    }
    return json({ error: 'Unknown action.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Something went wrong.' }, 500)
  }
})
