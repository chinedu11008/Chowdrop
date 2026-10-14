<script setup>
import { computed, ref } from 'vue'
import { CUR } from './data.js'

const props = defineProps({
  orders: { type: Array, default: () => [] },
  loading: Boolean,
  loadingMore: Boolean,
  hasMore: Boolean,
  totalOrders: { type: Number, default: 0 },
  role: { type: String, default: 'staff' },
  error: { type: String, default: '' },
  updatingId: { type: String, default: '' },
})
const emit = defineEmits(['refresh', 'load-more', 'update', 'back'])

const filter = ref('active')
const search = ref('')
const labels = {
  received: 'new order',
  preparing: 'preparing',
  ready: 'ready for pickup',
  out_for_delivery: 'out for delivery',
  delivered: 'delivered',
}
const paymentLabels = { paid: 'paid online', cod: 'cash on delivery' }
const nextStatus = {
  received: 'preparing',
  preparing: 'ready',
  ready: 'out_for_delivery',
  out_for_delivery: 'delivered',
}
const actionLabels = {
  preparing: 'accept and start preparing',
  ready: 'mark ready for pickup',
  out_for_delivery: 'hand to delivery rider',
  delivered: 'mark delivered',
}

const money = value => CUR + Number(value || 0).toLocaleString('en-NG')
const formatDate = value => new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
const activeCount = computed(() => props.orders.filter(o => o.fulfillment_status !== 'delivered').length)
const todayOrders = computed(() => props.orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()))
const todayValue = computed(() => todayOrders.value.reduce((sum, o) => sum + Number(o.total || 0), 0))
const preparingCount = computed(() => props.orders.filter(o => ['preparing', 'ready'].includes(o.fulfillment_status)).length)
const deliveryCount = computed(() => props.orders.filter(o => o.fulfillment_status === 'out_for_delivery').length)

const visibleOrders = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.orders.filter(order => {
    if (filter.value === 'active' && order.fulfillment_status === 'delivered') return false
    if (filter.value === 'preparing' && !['preparing', 'ready'].includes(order.fulfillment_status)) return false
    if (filter.value === 'delivery' && order.fulfillment_status !== 'out_for_delivery') return false
    if (filter.value === 'completed' && order.fulfillment_status !== 'delivered') return false
    if (!query) return true
    return [order.reference, order.name, order.phone, order.address]
      .some(value => String(value || '').toLowerCase().includes(query))
  })
})

function advance(order) {
  const fulfillment_status = nextStatus[order.fulfillment_status]
  if (fulfillment_status) emit('update', { id: order.id, fulfillment_status })
}
</script>

<template>
  <div class="business-page">
    <header class="business-header">
      <a class="business-brand" href="#home"><i class="fas fa-utensils"></i> chowdrop <span>for business</span></a>
      <div class="business-header-actions">
        <button class="business-button secondary" @click="emit('back')">customer site</button>
        <button class="business-button" :disabled="loading" @click="emit('refresh')">
          {{ loading ? 'refreshing…' : 'refresh orders' }}
        </button>
      </div>
    </header>

    <main class="business-main">
      <div class="business-intro">
        <div><p class="business-eyebrow">restaurant operations</p><h1>Order dashboard</h1></div>
        <p>Review paid and cash-on-delivery orders, then move each order through preparation and delivery. <span class="business-role">{{ role || 'staff' }} account</span></p>
      </div>

      <p v-if="error" class="business-error" role="alert">{{ error }}</p>

      <section class="business-stats" aria-label="Order summary">
        <article><span>active orders</span><strong>{{ activeCount }}</strong></article>
        <article><span>preparing or ready</span><strong>{{ preparingCount }}</strong></article>
        <article><span>with delivery rider</span><strong>{{ deliveryCount }}</strong></article>
        <article><span>today’s order value</span><strong>{{ money(todayValue) }}</strong><small>{{ todayOrders.length }} orders</small></article>
      </section>
      <p class="business-scope">Showing {{ orders.length }} of {{ totalOrders }} orders. Summary counts cover the orders loaded so far.</p>

      <section class="business-orders">
        <div class="business-toolbar">
          <label>Show
            <select v-model="filter">
              <option value="active">active orders</option>
              <option value="preparing">preparing or ready</option>
              <option value="delivery">out for delivery</option>
              <option v-if="role === 'manager'" value="completed">delivered</option>
              <option value="all">{{ role === 'manager' ? 'all orders' : 'all active orders' }}</option>
            </select>
          </label>
          <input v-model="search" type="search" aria-label="Search loaded orders" placeholder="search loaded orders">
        </div>

        <p v-if="loading && !orders.length" class="business-empty">Loading orders…</p>
        <p v-else-if="!visibleOrders.length" class="business-empty">
          {{ search ? 'No orders match your search.' : 'No orders in this view yet.' }}
        </p>

        <article v-for="order in visibleOrders" :key="order.id" class="business-order">
          <div class="business-order-head">
            <div><strong>{{ order.reference }}</strong><span :class="['business-status', order.fulfillment_status]">{{ labels[order.fulfillment_status] || 'new order' }}</span></div>
            <div class="business-total"><strong>{{ money(order.total) }}</strong><time>{{ formatDate(order.created_at) }}</time></div>
          </div>

          <div class="business-order-details">
            <div>
              <h2>{{ order.name || 'Customer' }}</h2>
              <a v-if="order.phone" :href="'tel:' + order.phone">{{ order.phone }}</a>
              <p>{{ order.address || 'No delivery address provided' }}</p>
              <p class="business-payment">{{ paymentLabels[order.status] || 'payment pending' }}</p>
            </div>
            <ul>
              <li v-for="(item, index) in order.items || []" :key="`${item.id}-${index}`">
                <span>{{ item.qty }} × {{ item.name }}</span>
              </li>
            </ul>
          </div>

          <div class="business-order-actions">
            <span v-if="nextStatus[order.fulfillment_status]">Next: {{ labels[nextStatus[order.fulfillment_status]] }}</span>
            <span v-else>Order complete</span>
            <button
              v-if="nextStatus[order.fulfillment_status]"
              class="business-button"
              :disabled="updatingId === order.id"
              @click="advance(order)"
            >{{ updatingId === order.id ? 'saving…' : actionLabels[nextStatus[order.fulfillment_status]] }}</button>
          </div>
        </article>
        <button v-if="hasMore" class="business-button business-load-more" :disabled="loadingMore" @click="emit('load-more')">
          {{ loadingMore ? 'loading older orders...' : 'load older orders' }}
        </button>
      </section>
    </main>
  </div>
</template>
