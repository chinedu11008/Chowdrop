<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { CUR, FEE, FREE_OVER, MAX_QTY, cats, menu, dishDescriptions, specials, steps, reviews } from './data.js'
import PaystackPop from '@paystack/inline-js'
import { supabase, supabaseConfigured } from './supabase.js'
import MerchantDashboard from './MerchantDashboard.vue'
import FaqChatbot from './FaqChatbot.vue'

const money = n => CUR + n.toLocaleString('en-NG')
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const loadCart = () => {
  const saved = load('cd-cart', {})
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
  return Object.fromEntries(Object.entries(saved)
    .filter(([id]) => menu.some(d => String(d.id) === id))
    .map(([id, qty]) => [id, Math.min(MAX_QTY, Math.max(0, Math.floor(Number(qty) || 0)))])
    .filter(([, qty]) => qty > 0))
}
const stages = [
  { key: 'received', label: 'placed' },
  { key: 'preparing', label: 'preparing' },
  { key: 'ready', label: 'ready' },
  { key: 'out_for_delivery', label: 'on the way' },
  { key: 'delivered', label: 'delivered' },
]
const pays = [{ v: 'card', t: 'pay online (card, bank transfer)' }, { v: 'cash', t: 'pay on delivery' }]
const payLabel = { paid: 'paid online', cod: 'pay on delivery' }
const gallery = menu.filter(m => m.img.startsWith('g-'))

const loading = ref(true), navOpen = ref(false), cartOpen = ref(false), showTop = ref(false)
const merchantView = ref(location.hash === '#business'), staffAccess = ref(false), categoryPageSlug = ref('')
const merchantOrders = ref([]), merchantLoading = ref(false), merchantError = ref(''), merchantUpdatingId = ref('')
const merchantLoadingMore = ref(false), merchantHasMore = ref(false), merchantNextPage = ref(0), merchantTotalCount = ref(0), staffRole = ref('')
const cat = ref('all'), q = ref(''), toast = ref('')
const activeDish = ref(null)
const cart = ref(loadCart())
const orders = ref([]), user = ref(null), authOpen = ref(false), mode = ref('login'), authMsg = ref(''), busy = ref(false)
const checkoutId = ref(sessionStorage.getItem('cd-checkout-id') || '')
const auth = reactive({ name: '', email: '', password: '' })
const form = reactive({ name: '', phone: '', address: '', pay: 'card' })
const errors = reactive({})

const lines = computed(() => menu.filter(d => cart.value[d.id]).map(d => ({ ...d, qty: cart.value[d.id] })))
const count = computed(() => lines.value.reduce((s, l) => s + l.qty, 0))
const subtotal = computed(() => lines.value.reduce((s, l) => s + l.qty * l.price, 0))
const fee = computed(() => (count.value && subtotal.value < FREE_OVER ? FEE : 0))
const total = computed(() => subtotal.value + fee.value)
const shown = computed(() => menu.filter(d => (cat.value === 'all' || d.cat === cat.value) && d.name.includes(q.value.trim().toLowerCase())))
const categoryLabels = { all: 'all dishes', meals: 'meals', cakes: 'cakes & bakes', snacks: 'snacks', drinks: 'drinks', breakfast: 'breakfast' }
const categoryTitle = computed(() => categoryLabels[cat.value] || 'menu')
const stage = o => stages.findIndex(s => s.key === o.fulfillment_status)

let toastTimer
const say = m => { toast.value = m; clearTimeout(toastTimer); toastTimer = setTimeout(() => (toast.value = ''), 1800) }
const add = d => {
  if ((cart.value[d.id] || 0) >= MAX_QTY) return say(`You can order up to ${MAX_QTY} of each item`)
  cart.value[d.id] = (cart.value[d.id] || 0) + 1
  say(`${d.name} added to cart`)
}
const openDish = d => { activeDish.value = d }
const closeDish = () => { activeDish.value = null }
const change = (id, n) => {
  const v = (cart.value[id] || 0) + n
  if (v > MAX_QTY) return say(`You can order up to ${MAX_QTY} of each item`)
  if (v > 0) cart.value[id] = v
  else delete cart.value[id]
}

async function call(body) {
  const { data, error } = await supabase.functions.invoke('api', { body })
  if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || error.message)
  return data
}

function resetCheckoutId() {
  checkoutId.value = ''
  sessionStorage.removeItem('cd-checkout-id')
}

async function place() {
  const e = {}
  if (!count.value) e.cart = 'Your cart is empty. Add something from the menu first.'
  if (form.name.trim().length < 2 || form.name.trim().length > 80) e.name = 'Enter your name (2–80 characters).'
  const phone = form.phone.trim()
  const phoneDigits = (phone.match(/\d/g) || []).length
  if (phone.length > 20 || !/^\+?[\d\s-]+$/.test(phone) || phoneDigits < 7 || phoneDigits > 15) e.phone = 'Enter a valid phone number.'
  if (form.address.trim().length < 8 || form.address.trim().length > 300) e.address = 'Enter your delivery address (8–300 characters).'
  Object.keys(errors).forEach(k => delete errors[k])
  Object.assign(errors, e)
  if (Object.keys(e).length) return
  if (!user.value) return openAuth('login', 'Log in to place your order.')
  busy.value = true
  try {
    const items = Object.entries(cart.value).map(([id, qty]) => ({ id: +id, qty }))
    checkoutId.value ||= crypto.randomUUID()
    sessionStorage.setItem('cd-checkout-id', checkoutId.value)
    const o = await call({ action: 'init', checkout_id: checkoutId.value, pay: form.pay, items, name: form.name, phone: form.phone, address: form.address })
    if (form.pay === 'card' && !o.paid) {
      if (!o.access_code) throw new Error('Payment could not be resumed. Try again in a moment.')
      await new Promise((ok, no) => new PaystackPop().resumeTransaction(o.access_code, { onSuccess: ok, onCancel: () => no(new Error('Payment cancelled. Your cart is still saved.')) }))
      const v = await call({ action: 'verify', reference: o.reference })
      if (!v.paid) throw new Error('We could not confirm your payment yet. Check "your orders" in a minute.')
    }
    resetCheckoutId()
    cart.value = {}
    form.address = ''
    say(`Order ${o.reference} placed`)
  } catch (err) {
    errors.pay = err.message
  } finally {
    busy.value = false
    loadOrders()
  }
}

watch(cart, v => { try { localStorage.setItem('cd-cart', JSON.stringify(v)) } catch { /* The cart remains usable for this session. */ } }, { deep: true })
watch([cart, () => form.name, () => form.phone, () => form.address, () => form.pay], resetCheckoutId, { deep: true })
function openAuth(m = 'login', msg = '') { mode.value = m; authMsg.value = msg; authOpen.value = true }
async function submitAuth() {
  busy.value = true; authMsg.value = ''
  try {
    if (!supabaseConfigured) {
      authMsg.value = 'Supabase is not configured for this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in your hosting settings, then rebuild and redeploy.'
      return
    }
    const { email, password, name } = auth
    const { data, error } = mode.value === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { name } } })
    if (error) { authMsg.value = error.message; return }
    if (!data.session) { authMsg.value = 'Check your email to confirm your account, then log in.'; return }
    authOpen.value = false; auth.password = ''
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to contact the authentication service.'
    authMsg.value = /failed to fetch|networkerror|load failed/i.test(message)
      ? 'Cannot reach Supabase from this deployment. Check that the hosted VITE_SUPABASE_URL and public key are from the same project, then rebuild and redeploy. If they are correct, check the browser console for a network or CORS error.'
      : message
  } finally {
    busy.value = false
  }
}
async function loadOrders() {
  if (!user.value) { orders.value = []; return }
  const { data, error } = await supabase.from('orders')
    .select('id,reference,items,total,status,name,phone,address,created_at,fulfillment_status')
    .order('created_at', { ascending: false })
  if (!error) orders.value = data || []
}

async function checkStaffAccess() {
  try {
    const result = await call({ action: 'merchant-check' })
    staffAccess.value = result.staff === true
    staffRole.value = result.role || ''
    if (!staffAccess.value && merchantView.value) merchantError.value = 'This account is not registered as restaurant staff.'
    return staffAccess.value
  } catch {
    staffAccess.value = false
    staffRole.value = ''
    if (merchantView.value) merchantError.value = 'Could not verify staff access. Check the Supabase setup and try again.'
    return false
  }
}

async function loadMerchantOrders({ append = false, silent = false } = {}) {
  if (!user.value) {
    merchantError.value = 'Log in with a restaurant staff account to view orders.'
    return
  }
  if (merchantLoading.value) return
  const page = append ? merchantNextPage.value : 0
  merchantLoading.value = true
  merchantLoadingMore.value = append
  if (!silent) merchantError.value = ''
  try {
    const result = await call({ action: 'merchant-list', page })
    staffAccess.value = true
    staffRole.value = result.role || staffRole.value
    const pageOrders = result.orders || []
    if (append) {
      const knownIds = new Set(merchantOrders.value.map(order => order.id))
      merchantOrders.value = [...merchantOrders.value, ...pageOrders.filter(order => !knownIds.has(order.id))]
    } else if (silent) {
      const pageIds = new Set(pageOrders.map(order => order.id))
      const olderOrders = merchantOrders.value.filter(order => !pageIds.has(order.id))
      merchantOrders.value = [...pageOrders, ...olderOrders]
    } else {
      merchantOrders.value = pageOrders
    }
    merchantTotalCount.value = result.total || 0
    if (append) {
      merchantNextPage.value = page + 1
      merchantHasMore.value = result.has_more === true && pageOrders.length > 0
    } else if (silent) {
      merchantHasMore.value = merchantNextPage.value * 50 < merchantTotalCount.value
    } else {
      merchantNextPage.value = 1
      merchantHasMore.value = result.has_more === true
    }
  } catch (err) {
    if (!silent) merchantError.value = err.message || 'Unable to load restaurant orders.'
  } finally {
    merchantLoading.value = false
    merchantLoadingMore.value = false
  }
}

async function updateMerchantOrder({ id, fulfillment_status }) {
  merchantUpdatingId.value = id
  merchantError.value = ''
  try {
    const result = await call({ action: 'merchant-update', order_id: id, fulfillment_status })
    merchantOrders.value = merchantOrders.value.map(o => o.id === id ? result.order : o)
    orders.value = orders.value.map(o => o.id === id ? result.order : o)
    say(`Order ${result.order.reference} updated`)
  } catch (err) {
    merchantError.value = err.message || 'Unable to update this order.'
  } finally {
    merchantUpdatingId.value = ''
  }
}

function openMerchant() {
  if (!user.value) return openAuth('login', 'Log in with a restaurant staff account.')
  if (location.hash === '#business') loadMerchantOrders()
  else location.hash = 'business'
}

function openCategory(value) {
  if (!cats.includes(value)) return
  navOpen.value = false
  cat.value = value
  const hash = `#category/${value}`
  if (location.hash === hash) categoryPageSlug.value = value
  else location.hash = hash
}

async function closeMerchant() {
  merchantView.value = false
  location.hash = 'home'
  await nextTick()
  document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' })
}

async function navigateToSection(section) {
  navOpen.value = false
  categoryPageSlug.value = ''
  cat.value = 'all'
  if (location.hash !== `#${section}`) location.hash = section
  await nextTick()
  document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' })
}

function onRouteChange() {
  const hash = location.hash.slice(1)
  merchantView.value = hash === 'business'
  if (merchantView.value) {
    categoryPageSlug.value = ''
    merchantNextPage.value = 0
    document.title = 'Restaurant dashboard | ChowDrop'
    if (user.value) loadMerchantOrders()
    return
  }

  const category = hash.match(/^category\/([a-z]+)$/)?.[1]
  if (category && cats.includes(category)) {
    categoryPageSlug.value = category
    cat.value = category
    document.title = `${categoryLabels[category]} | ChowDrop`
    scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    categoryPageSlug.value = ''
    cat.value = 'all'
    document.title = 'ChowDrop'
  }
}

watch(user, u => {
  if (ordersChannel) {
    void supabase.removeChannel(ordersChannel)
    ordersChannel = null
  }
  loadOrders()
  if (u) {
    form.name ||= u.user_metadata?.name || ''
    ordersChannel = supabase.channel(`orders:${u.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        void loadOrders()
        if (!merchantView.value) return
        const changedOrder = payload.new
        const alreadyLoaded = changedOrder?.id && merchantOrders.value.some(order => order.id === changedOrder.id)
        if (payload.eventType === 'UPDATE' && alreadyLoaded) {
          merchantOrders.value = merchantOrders.value.map(order => order.id === changedOrder.id ? { ...order, ...changedOrder } : order)
        } else {
          void loadMerchantOrders({ silent: true })
        }
      })
      .subscribe()
    checkStaffAccess().then(isStaff => { if (isStaff && merchantView.value) loadMerchantOrders() })
  } else {
    staffAccess.value = false
    staffRole.value = ''
    merchantOrders.value = []
    merchantHasMore.value = false
    merchantTotalCount.value = 0
    if (merchantView.value) merchantError.value = 'Log in with a restaurant staff account to view orders.'
  }
})

const onScroll = () => { navOpen.value = false; showTop.value = scrollY > 60 }
let sub, syncTimer, ordersChannel
const syncOrders = () => {
  if (document.visibilityState !== 'visible' || !user.value) return
  void loadOrders()
  if (merchantView.value) void loadMerchantOrders({ silent: true })
}
onMounted(() => {
  addEventListener('hashchange', onRouteChange)
  onRouteChange()
  sub = supabase.auth.onAuthStateChange((_, s) => { user.value = s?.user ?? null }).data.subscription
  addEventListener('scroll', onScroll)
  document.addEventListener('visibilitychange', syncOrders)
  syncTimer = setInterval(syncOrders, 20000)
  setTimeout(() => (loading.value = false), 1200)
})
onBeforeUnmount(() => { clearInterval(syncTimer); removeEventListener('scroll', onScroll); removeEventListener('hashchange', onRouteChange); document.removeEventListener('visibilitychange', syncOrders); sub?.unsubscribe(); if (ordersChannel) void supabase.removeChannel(ordersChannel) })
</script>

<template>
  <MerchantDashboard
    v-if="merchantView"
    :orders="merchantOrders"
    :loading="merchantLoading"
    :loading-more="merchantLoadingMore"
    :has-more="merchantHasMore"
    :total-orders="merchantTotalCount"
    :role="staffRole"
    :error="merchantError"
    :updating-id="merchantUpdatingId"
    @refresh="loadMerchantOrders"
    @load-more="loadMerchantOrders({ append: true })"
    @update="updateMerchantOrder"
    @back="closeMerchant"
  />
  <div v-else class="storefront">
  <header>
    <a href="#home" class="logo" @click.prevent="navigateToSection('home')"><i class="fas fa-utensils"></i>chowdrop</a>
    <button id="menu-bar" type="button" :aria-label="navOpen ? 'Close navigation' : 'Open navigation'" :aria-expanded="navOpen" @click="navOpen = !navOpen"><i :class="['fas', navOpen ? 'fa-times' : 'fa-bars']"></i></button>
    <nav class="navbar" :class="{ active: navOpen }">
      <a v-for="l in ['home', 'speciality', 'menu', 'gallery', 'review', 'order']" :key="l" :href="'#' + l" @click.prevent="navigateToSection(l)">{{ l }}</a>
    </nav>
    <div class="header-actions">
      <button class="cart-btn" aria-label="Open cart" @click="cartOpen = true">
        <i class="fas fa-shopping-cart"></i><b v-if="count">{{ count }}</b>
      </button>
      <button v-if="user" class="login-btn" @click="supabase.auth.signOut()">log out</button>
      <button v-else class="login-btn" @click="openAuth('login')">log in</button>
      <button v-if="user && staffAccess" class="login-btn business-link" @click="openMerchant">restaurant dashboard</button>
    </div>
  </header>

  <main v-if="categoryPageSlug" class="category-page">
    <section class="category-hero">
      <a class="category-back" href="#menu" @click.prevent="navigateToSection('menu')"><i class="fas fa-arrow-left"></i> back to menu</a>
      <p class="category-eyebrow">fresh from our kitchen</p>
      <h1>{{ categoryTitle }}</h1>
      <p>Find something delicious, add it to your cart, and we’ll take it from there.</p>
      <label class="category-search">
        <i class="fas fa-search" aria-hidden="true"></i>
        <input v-model="q" type="search" :placeholder="'search ' + categoryTitle" :aria-label="'Search ' + categoryTitle">
      </label>
      <div class="category-meta"><span>{{ shown.length }} {{ shown.length === 1 ? 'item' : 'items' }}</span><span>free delivery over {{ money(FREE_OVER) }}</span></div>
    </section>
    <section class="category-content">
      <nav class="category-tabs" aria-label="Browse menu categories">
        <button v-for="c in cats" :key="c" type="button" :class="{ on: cat === c }" :aria-current="cat === c ? 'page' : undefined" @click="openCategory(c)">{{ categoryLabels[c] }}</button>
      </nav>
      <div class="box-container">
        <article class="box" v-for="d in shown" :key="d.id">
          <button class="dish-preview" type="button" :aria-label="'View details for ' + d.name" @click="openDish(d)">
            <span class="price">{{ money(d.price) }}</span>
            <img :src="'/images/' + d.img" :alt="d.name" loading="lazy">
            <span class="product-category">{{ categoryLabels[d.cat] }}</span><span class="dish-card-name">{{ d.name }}</span>
            <span class="stars" aria-label="Rated 4 out of 5"><i v-for="n in 5" :key="n" :class="[n <= 4 ? 'fas' : 'far', 'fa-star']"></i></span>
            <span class="dish-card-hint"><i class="fas fa-search-plus" aria-hidden="true"></i> view dish details</span>
          </button>
          <button class="btn" type="button" @click="add(d)"><i class="fas fa-plus" aria-hidden="true"></i> add to cart</button>
        </article>
        <p v-if="!shown.length" class="empty category-empty">Nothing matches “{{ q }}”. Try another search or category.</p>
      </div>
      <p class="category-footer-link">Want to see everything? <a href="#category/all">Browse the full menu</a></p>
    </section>
  </main>

  <template v-else>
  <section class="home" id="home">
    <div class="content">
      <h3>food made with love</h3>
      <p>Hot meals, fresh bakes and cold drinks, delivered to your door. Pick what you like, check out in a minute and follow your order right here.</p>
      <a href="#menu" class="btn">order now</a>
    </div>
    <div class="image"><img src="/images/home-img.png" alt="Bacon cheeseburger"></div>
  </section>

  <section class="speciality" id="speciality">
    <h1 class="heading">our <span>speciality</span></h1>
    <div class="box-container">
      <a class="box" v-for="s in specials" :key="s.name" :href="'#category/' + s.category" :aria-label="'Browse ' + categoryLabels[s.category] + ': ' + s.name" @click.prevent="openCategory(s.category)">
        <img class="image" :src="'/images/' + s.img" :alt="s.name">
        <div class="content"><i :class="['fas', s.icon]"></i><h3>{{ s.name }}</h3><p>{{ s.text }}</p><span class="speciality-action">browse {{ categoryLabels[s.category] }} <i class="fas fa-arrow-right" aria-hidden="true"></i></span></div>
      </a>
    </div>
  </section>

  <section class="popular" id="menu">
    <h1 class="heading">our <span>menu</span></h1>
    <div class="toolbar">
      <nav class="tabs" aria-label="Browse menu categories"><button v-for="c in cats" :key="c" type="button" :class="{ on: cat === c }" @click="openCategory(c)">{{ categoryLabels[c] }}</button></nav>
      <input v-model="q" type="search" placeholder="search the menu" aria-label="Search the menu">
    </div>
    <div class="box-container">
      <article class="box" v-for="d in shown" :key="d.id">
        <button class="dish-preview" type="button" :aria-label="'View details for ' + d.name" @click="openDish(d)">
          <span class="price">{{ money(d.price) }}</span>
          <img :src="'/images/' + d.img" :alt="d.name" loading="lazy">
          <span class="dish-card-name">{{ d.name }}</span>
          <span class="stars" aria-label="Rated 4 out of 5"><i v-for="n in 5" :key="n" :class="[n <= 4 ? 'fas' : 'far', 'fa-star']"></i></span>
          <span class="dish-card-hint"><i class="fas fa-search-plus" aria-hidden="true"></i> view dish details</span>
        </button>
        <button class="btn" type="button" @click="add(d)"><i class="fas fa-plus" aria-hidden="true"></i> add to cart</button>
      </article>
      <p v-if="!shown.length" class="empty">Nothing matches "{{ q }}". Try another word or category.</p>
    </div>
  </section>

  <div class="step-container">
    <h1 class="heading">how it <span>works</span></h1>
    <section class="steps">
      <div class="box" v-for="s in steps" :key="s.text">
        <div class="ring"><i :class="['fas', s.icon]"></i></div>
        <h3>{{ s.text }}</h3>
      </div>
    </section>
  </div>

  <section class="gallery" id="gallery">
    <h1 class="heading">our food <span>gallery</span></h1>
    <div class="box-container">
      <div class="box" v-for="d in gallery" :key="d.id">
        <img :src="'/images/' + d.img" :alt="d.name" loading="lazy">
        <div class="content"><h3>{{ d.name }}</h3><p>{{ money(d.price) }}</p><button class="btn" @click="add(d)">order now</button></div>
      </div>
    </div>
  </section>

  <section class="review" id="review">
    <h1 class="heading">our customers <span>reviews</span></h1>
    <div class="box-container">
      <div class="box" v-for="r in reviews" :key="r.name">
        <div class="avatar">{{ r.name[0] }}</div>
        <h3>{{ r.name }}</h3>
        <div class="stars"><i v-for="n in 5" :key="n" :class="[n <= r.stars ? 'fas' : 'far', 'fa-star']"></i></div>
        <p>{{ r.text }}</p>
      </div>
    </div>
  </section>

  <section class="order" id="order">
    <h1 class="heading"><span>order</span> now</h1>
    <div class="row">
      <div class="image"><img src="/images/order-img.jpg" alt="Waiter serving wine"></div>
      <form @submit.prevent="place" novalidate>
        <ul class="summary" v-if="lines.length">
          <li v-for="l in lines" :key="l.id"><span>{{ l.qty }} × {{ l.name }}</span><b>{{ money(l.qty * l.price) }}</b></li>
          <li><span>delivery</span><b>{{ fee ? money(fee) : 'free' }}</b></li>
          <li class="sum"><span>total</span><b>{{ money(total) }}</b></li>
        </ul>
        <p v-else class="empty">Your cart is empty. <a href="#menu">Browse the menu</a></p>
        <p v-if="!user" class="empty">Log in or create an account to place your order. <a href="#" @click.prevent="openAuth('login')">Log in</a></p>
        <div class="inputBox">
          <input v-model="form.name" :class="{ bad: errors.name }" placeholder="name" autocomplete="name" maxlength="80">
          <input v-model="form.phone" :class="{ bad: errors.phone }" type="tel" placeholder="phone number" autocomplete="tel" maxlength="20">
        </div>
        <textarea v-model="form.address" :class="{ bad: errors.address }" placeholder="delivery address" rows="4" maxlength="300"></textarea>
        <div class="pay"><label v-for="p in pays" :key="p.v"><input type="radio" v-model="form.pay" :value="p.v"> {{ p.t }}</label></div>
        <p class="err" v-for="(msg, k) in errors" :key="k">{{ msg }}</p>
        <button class="btn" :disabled="busy">{{ busy ? 'processing...' : form.pay === 'card' ? 'pay ' + money(total) : 'place order' }}</button>
      </form>
    </div>
    <div class="orders" v-if="orders.length">
      <h2>your orders</h2>
      <div class="ord" v-for="o in orders" :key="o.id">
        <b>{{ o.reference }}</b> <span>{{ money(o.total) }}, {{ payLabel[o.status] || 'awaiting payment' }}</span>
        <p>{{ o.items.map(i => i.qty + ' × ' + i.name).join(', ') }}</p>
        <div class="track" v-if="o.status !== 'pending'"><span v-for="(s, i) in stages" :key="s.key" :class="{ done: i <= stage(o) }">{{ s.label }}</span></div>
      </div>
    </div>
  </section>

  <section class="footer">
    <div class="share"><a v-for="s in ['facebook', 'twitter', 'instagram', 'pinterest', 'linkedin']" :key="s" href="#" class="btn">{{ s }}</a></div>
    <h1 class="credit">&copy; {{ new Date().getFullYear() }} <span>chowdrop</span>. all rights reserved!</h1>
  </section>

  <a href="#home" class="fas fa-angle-up" id="scroll-top" :class="{ active: showTop }" aria-label="Back to top"></a>
  </template>

  <div class="scrim" v-if="cartOpen" @click="cartOpen = false"></div>
  <aside class="drawer" :class="{ open: cartOpen }" aria-label="Cart" :aria-hidden="!cartOpen">
    <div class="dhead"><h3>your cart</h3><button aria-label="Close cart" @click="cartOpen = false"><i class="fas fa-times"></i></button></div>
    <p v-if="!lines.length" class="empty">Nothing here yet. Add something tasty from the menu.</p>
    <div class="line" v-for="l in lines" :key="l.id">
      <img :src="'/images/' + l.img" :alt="l.name">
      <div><h4>{{ l.name }}</h4><span>{{ money(l.price) }}</span></div>
      <div class="qty"><button aria-label="Remove one" @click="change(l.id, -1)">-</button>{{ l.qty }}<button aria-label="Add one" @click="change(l.id, 1)">+</button></div>
    </div>
    <div class="dfoot" v-if="lines.length">
      <p class="hint" v-if="fee">Add {{ money(FREE_OVER - subtotal) }} more for free delivery.</p>
      <p><span>subtotal</span><b>{{ money(subtotal) }}</b></p>
      <p><span>delivery</span><b>{{ fee ? money(fee) : 'free' }}</b></p>
      <a href="#order" class="btn" @click.prevent="cartOpen = false; navigateToSection('order')">checkout {{ money(total) }}</a>
    </div>
  </aside>

  <div class="scrim auth-scrim" v-if="authOpen" @click="authOpen = false"></div>
  <form class="modal" v-if="authOpen" role="dialog" aria-modal="true" aria-labelledby="auth-title" @submit.prevent="submitAuth">
    <h3 id="auth-title">{{ mode === 'login' ? 'log in' : 'create account' }}</h3>
    <input v-if="mode === 'signup'" v-model="auth.name" placeholder="full name" autocomplete="name" required>
    <input v-model="auth.email" type="email" placeholder="email" autocomplete="email" required>
    <input v-model="auth.password" type="password" placeholder="password (6+ characters)" minlength="6" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required>
    <p class="err" v-if="authMsg">{{ authMsg }}</p>
    <button class="btn" :disabled="busy">{{ mode === 'login' ? 'log in' : 'sign up' }}</button>
    <p class="swap">{{ mode === 'login' ? 'New here?' : 'Already have an account?' }} <a href="#" @click.prevent="mode = mode === 'login' ? 'signup' : 'login'; authMsg = ''">{{ mode === 'login' ? 'Create an account' : 'Log in' }}</a></p>
  </form>

  <div class="scrim dish-scrim" v-if="activeDish" @click="closeDish"></div>
  <section v-if="activeDish" class="dish-modal" role="dialog" aria-modal="true" aria-labelledby="dish-title" @keydown.esc.window="closeDish">
    <button class="dish-close" type="button" aria-label="Close dish details" @click="closeDish"><i class="fas fa-times"></i></button>
    <div class="dish-modal-image"><img :src="'/images/' + activeDish.img" :alt="activeDish.name"></div>
    <div class="dish-modal-content">
      <p class="product-category">{{ categoryLabels[activeDish.cat] }}</p>
      <h2 id="dish-title">{{ activeDish.name }}</h2>
      <p class="dish-description">{{ dishDescriptions[activeDish.id] }}</p>
      <p class="dish-modal-price">{{ money(activeDish.price) }}</p>
      <button class="btn" type="button" @click="add(activeDish); closeDish()"><i class="fas fa-plus" aria-hidden="true"></i> add to cart</button>
    </div>
  </section>

  <div class="toast" :class="{ show: toast }" role="status">{{ toast }}</div>
  <div class="loader-container" :class="{ 'fade-out': !loading }"><img src="/images/loader.gif" alt="Loading"></div>
  </div>
  <FaqChatbot v-if="!merchantView" />
</template>
