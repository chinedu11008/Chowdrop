import { menu, FEE, FREE_OVER, MAX_QTY } from '../supabase/functions/_shared/menu.js'
export { menu, FEE, FREE_OVER, MAX_QTY }
export const CUR = '₦'
export const cats = ['all', 'meals', 'cakes', 'snacks', 'drinks', 'breakfast']
export const dishDescriptions = {
  1: 'A juicy beef burger layered with melted cheese and fresh toppings in a toasted bun.',
  2: 'Soft cake with bright orange flavor and a smooth cream finish.',
  3: 'A crunchy, savory snack mix for sharing or a quick bite.',
  4: 'A tender muffin baked with chocolate chips in every bite.',
  5: 'A refreshing selection of fruit juices, served chilled.',
  6: 'A classic sesame bun filled with a savory burger and fresh toppings.',
  7: 'A toasted club sandwich stacked for a satisfying meal.',
  8: 'Seasoned chicken and fresh fillings wrapped up for an easy meal.',
  9: 'Soft chocolate cupcakes finished in bite-sized portions.',
  10: 'Crispy fried chicken with a golden coating and tender center.',
  11: 'Egg and toast made for a simple, filling breakfast.',
  12: 'Small chocolate bites for a quick sweet snack.',
  13: 'Hearty oat bread with sweet blueberry flavor.'
}
export const specials = [
  { name: 'tasty burger', category: 'meals', icon: 'fa-hamburger', img: 'p-1.jpg', text: 'Juicy beef, melted cheese, toasted bun.' },
  { name: 'club sandwich', category: 'meals', icon: 'fa-bread-slice', img: 'g-2.jpg', text: 'Stacked and toasted, made to order.' },
  { name: 'crispy chicken', category: 'meals', icon: 'fa-drumstick-bite', img: 'g-6.jpg', text: 'Golden, crunchy and served hot.' },
  { name: 'fresh cakes', category: 'cakes', icon: 'fa-birthday-cake', img: 'g-4.jpg', text: 'Baked daily, light and creamy.' },
  { name: 'cold drinks', category: 'drinks', icon: 'fa-glass-martini-alt', img: 'p-5.jpg', text: 'Fresh juices and smoothies.' },
  { name: 'healthy breakfast', category: 'breakfast', icon: 'fa-egg', img: 'g-7.jpg', text: 'Start the day with something good.' }
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
