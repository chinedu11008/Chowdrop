<script setup>
import { nextTick, ref, watch } from 'vue'
import { CUR, FEE, FREE_OVER } from './data.js'

const isOpen = ref(false)
const draft = ref('')
const input = ref(null)
const messageList = ref(null)
let nextId = 2
const messages = ref([
  { id: 1, role: 'bot', text: 'Hi! I can help with the menu, delivery, payments, accounts, and order tracking.' },
])

const suggestions = ['What is the delivery fee?', 'How can I track my order?', 'What payment methods do you accept?']
const money = amount => CUR + amount.toLocaleString('en-NG')

function answerFor(question) {
  const text = question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

  if (/\b(manager|restaurant staff|staff access|dashboard access)\b/.test(text)) {
    return 'A manager first creates a normal account with Sign up. The restaurant owner or project admin then needs to grant that account manager access in Supabase. Signing up alone does not unlock the restaurant dashboard.'
  }
  if (/\b(how long|eta|arrival time|delivery time|when.*arrive|how long.*deliver)\b/.test(text)) {
    return 'The app shows order progress, but it does not currently provide an estimated arrival time. Check “your orders” for the latest status.'
  }
  if (/\b(track|tracking|order status|where.*order|order progress|order update)\b/.test(text)) {
    return 'After you place an order, sign in and check the “your orders” section near the bottom of the page. It updates as the restaurant moves your order through preparation and delivery.'
  }
  if (/\b(delivery|deliver|fee|free delivery|shipping)\b/.test(text)) {
    return `Delivery costs ${money(FEE)} for orders below ${money(FREE_OVER)}. Delivery is free when your item subtotal is ${money(FREE_OVER)} or more.`
  }
  if (/\b(payment|pay|paystack|cash|card|bank transfer)\b/.test(text)) {
    return 'You can pay online at checkout or choose cash on delivery. Online payments are handled through Paystack.'
  }
  if (/\b(cancel|cancellation|edit|change my order|change an order|refund|charged twice)\b/.test(text)) {
    return 'The app does not currently have an order cancellation or edit button. Contact the restaurant through your usual channel as soon as possible if you need to change an order.'
  }
  if (/\b(sign up|signup|register|log in|login|account|password|confirm email)\b/.test(text)) {
    return 'Use Sign up to create an account and Log in to return to it. If email confirmation is enabled, confirm your email before logging in.'
  }
  if (/\b(allergen|allergy|allergic|ingredients|ingredient)\b/.test(text)) {
    return 'The menu does not list full ingredients or allergen information yet. Please confirm ingredients with the restaurant before ordering if you have an allergy.'
  }
  if (/\b(menu|food|dish|meal|category|cart|add|price|item|snack|cake|drink|breakfast|burger|sandwich)\b/.test(text)) {
    return 'Browse the menu categories to find a dish. Select a dish image or name to see its description and price, then choose Add to cart when you are ready.'
  }
  return 'I can answer questions about menu items, delivery fees, payment methods, accounts, and order tracking. Which would you like to know about?'
}

watch(messages, async () => {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
}, { deep: true })

async function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    input.value?.focus()
  }
}

function ask(question) {
  const text = question.trim()
  if (!text) return
  messages.value.push({ id: nextId++, role: 'user', text })
  messages.value.push({ id: nextId++, role: 'bot', text: answerFor(text) })
  draft.value = ''
}

function submit() {
  ask(draft.value)
}
</script>

<template>
  <div class="faq-chatbot" :class="{ 'is-open': isOpen }">
    <section v-if="isOpen" id="faq-chat-panel" class="faq-panel" role="dialog" aria-label="ChowDrop FAQ assistant" aria-modal="false">
      <header class="faq-header">
        <div class="faq-avatar"><i class="fas fa-utensils" aria-hidden="true"></i></div>
        <div class="faq-heading"><h2>ChowDrop help</h2><p>Ask us a quick question</p></div>
        <button class="faq-close" type="button" aria-label="Close FAQ assistant" @click="toggle"><i class="fas fa-times" aria-hidden="true"></i></button>
      </header>

      <div ref="messageList" class="faq-messages" role="log" aria-live="polite" aria-relevant="additions text">
        <article v-for="message in messages" :key="message.id" :class="['faq-message', message.role]">
          <span>{{ message.role === 'bot' ? 'ChowDrop' : 'You' }}</span>
          <p>{{ message.text }}</p>
        </article>
        <div v-if="messages.length === 1" class="faq-suggestions" aria-label="Suggested questions">
          <button v-for="question in suggestions" :key="question" type="button" @click="ask(question)">{{ question }}</button>
        </div>
      </div>

      <form class="faq-form" @submit.prevent="submit">
        <label class="sr-only" for="faq-question">Ask a question</label>
        <input id="faq-question" ref="input" v-model="draft" type="text" autocomplete="off" placeholder="Type your question…">
        <button type="submit" aria-label="Send question" :disabled="!draft.trim()"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>
      </form>
    </section>

    <button class="faq-launcher" type="button" :aria-expanded="isOpen" :aria-controls="isOpen ? 'faq-chat-panel' : undefined" @click="toggle">
      <i :class="['fas', isOpen ? 'fa-times' : 'fa-comment-dots']" aria-hidden="true"></i>
      <span>{{ isOpen ? 'Close help' : 'Need help?' }}</span>
    </button>
  </div>
</template>
