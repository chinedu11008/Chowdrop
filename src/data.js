import { menu, FEE, FREE_OVER, MAX_QTY } from '../supabase/functions/_shared/menu.js'
export { menu, FEE, FREE_OVER, MAX_QTY }
export const CUR = '₦'
export const cats = ['all', 'meals', 'cakes', 'snacks', 'drinks', 'breakfast']
export const specials = [
  { name: 'tasty burger', icon: 'fa-hamburger', img: 'p-1.jpg', text: 'Juicy beef, melted cheese, toasted bun.' },
  { name: 'club sandwich', icon: 'fa-bread-slice', img: 'g-2.jpg', text: 'Stacked and toasted, made to order.' },
  { name: 'crispy chicken', icon: 'fa-drumstick-bite', img: 'g-6.jpg', text: 'Golden, crunchy and served hot.' },
  { name: 'fresh cakes', icon: 'fa-birthday-cake', img: 'g-4.jpg', text: 'Baked daily, light and creamy.' },
  { name: 'cold drinks', icon: 'fa-glass-martini-alt', img: 'p-5.jpg', text: 'Fresh juices and smoothies.' },
  { name: 'healthy breakfast', icon: 'fa-egg', img: 'g-7.jpg', text: 'Start the day with something good.' }
]
export const steps = [
  { icon: 'fa-utensils', text: 'choose your favorite food' },
  { icon: 'fa-motorcycle', text: `fast delivery, free over ${CUR}${FREE_OVER.toLocaleString('en-NG')}` },
  { icon: 'fa-credit-card', text: 'easy payment methods' },
  { icon: 'fa-smile', text: 'and finally, enjoy your food' }
]
export const reviews = [
  { name: 'sam', stars: 5, text: 'Hot food, right on time. The burger was even better than the photo.' },
  { name: 'ada', stars: 4, text: 'Easy to order, and my cart was still there when I came back later.' },
  { name: 'jo', stars: 5, text: 'The muffins and fresh juice made my morning meeting.' }
]
