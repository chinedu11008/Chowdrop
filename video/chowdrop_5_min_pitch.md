# ChowDrop: 5-minute product pitch video

**Format:** product walkthrough with voiceover  
**Runtime:** 5:00  
**Audience:** hackathon judges evaluating technical execution, UX, business viability, and communication

## 0:00–0:25 — Hook

**Visuals:** Open on the ChowDrop home page. Cut quickly between food categories, checkout, and the restaurant dashboard. Show the line: “Local food ordering, from browse to delivery.”

**Voiceover:**  
Ordering food should be simple for customers and manageable for restaurants. ChowDrop connects the two: customers browse, order, pay, and follow progress; staff move orders from received to delivered.

## 0:25–0:55 — Inspiration and problem

**Visuals:** Show the menu and delivery details. On-screen labels: “Find a meal,” “Place an order,” “Keep orders moving.”

**Voiceover:**  
ChowDrop was inspired by the gap between a customer's need for a clear ordering flow and a restaurant team's need to keep orders organized. It's designed for local diners and restaurants in Nigeria, with naira pricing, online payment, and cash on delivery.

## 0:55–1:40 — Customer experience and UX

**Visuals:** Demonstrate category navigation, search, opening a dish description, adding it to the cart, viewing the delivery fee and total, and selecting a payment method. Use a test account and stop before any real charge. Hold briefly on the order status view.

**Voiceover:**  
Customers can browse by category, search, and open a dish to read its description before adding it to the cart. The cart shows the subtotal, delivery fee, and total. At checkout, they choose online payment or cash on delivery. After placing an order, they can follow status updates in their order history. The goal is to make key choices visible: what's on the menu, what it costs, and where the order is.

## 1:40–2:20 — Restaurant operations

**Visuals:** Switch to the business dashboard with seeded demo orders. Show search and filters, then advance one order from received to preparing and ready. Use demo data only.

**Voiceover:**  
The restaurant dashboard gives authorized staff a shared order queue. They can search and filter orders, see totals, payment status, contact and delivery details, then advance fulfillment from received to preparing, ready, out for delivery, and delivered. The customer sees those updates in their order history. This connects checkout with the work happening in the restaurant.

## 2:20–3:05 — Technical execution

**Visuals:** Show an architecture diagram: Browser → Vue app on Vercel → Supabase Auth and PostgreSQL; Edge Functions → Paystack. Highlight “server-calculated totals,” “payment verification,” and “staff access checks.”

**Voiceover:**  
The interface uses Vue 3 and Vite, hosted on Vercel. Supabase provides authentication and PostgreSQL. Row-level security limits customers to their own orders. Checkout and staff operations go through Supabase Edge Functions. The payment function calculates totals from the server's menu, initializes Paystack, and verifies payment before marking an order paid. Staff requests check restaurant staff membership before listing or updating orders. Price, payment, and permission decisions stay on the backend.

## 3:05–3:50 — Business model and financial path

**Visuals:** Show “Pilot → Measure → Improve.” Label “Current: delivery fee in checkout” and “To validate: order commission / optional merchant tier.” Do not show invented prices, revenue, or traction.

**Voiceover:**  
The current checkout includes a configurable delivery fee and a free-delivery threshold. For sustainable revenue, we would test a commission on completed orders; an optional paid merchant tier could add business tools. We have not validated prices or unit economics yet. A small restaurant pilot would measure order volume, repeat use, payment fees, delivery costs, and time saved. Those results would show whether revenue can cover costs while providing value to customers and merchants. This is a path to sustainability based on evidence, not assumed traction.

## 3:50–4:30 — Product value and accomplishment

**Visuals:** Split screen: customer menu and order tracking on one side, staff dashboard on the other. Show: “One order, two useful views.”

**Voiceover:**  
ChowDrop is designed for Nigerian diners and restaurant teams. It combines local payment choices with food browsing and order updates, while giving merchants a basic operations dashboard. Our accomplishment is bringing the customer and staff journeys into one application. The next proof point is whether restaurants can manage orders with less friction and customers choose to return.

## 4:30–5:00 — Challenges, learning, and close

**Visuals:** Show the Vercel deployment settings briefly, then return to the ChowDrop home page and logo. End card: “ChowDrop — Local food ordering, from browse to delivery.”

**Voiceover:**  
A challenge was production setup: Vite environment variables are baked into the build, so the Supabase URL and public key must match, and the app must be rebuilt after changes. Checkout also taught us to recalculate prices and confirm payment on the server. Next, we want to test with restaurants, validate the business model, and improve from real feedback. ChowDrop makes local ordering and fulfillment clearer for both sides.

## Production notes

- Record the real app interface where possible. Use seeded demo orders; do not stage fake revenue, user counts, or customer testimonials.
- If production authentication or payment is not working during recording, use a clearly labeled local or staging demo and describe the deployment status accurately.
- Add subtitles and keep captions short enough to read on screen.
- Keep the architecture diagram legible and show the browser, Vercel, Supabase, Edge Functions, and Paystack as separate components.
- The voiceover is intentionally shorter than five minutes to leave time for interface actions, transitions, and readable visuals.

## Built with

- **Frontend framework:** Vue 3
- **Build tool:** Vite
- **Backend and database:** Supabase Auth, PostgreSQL, and Edge Functions
- **Payments:** Paystack
- **Hosting:** Vercel
