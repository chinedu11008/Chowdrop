# ChowDrop: Vue 3 + Supabase (auth, orders) + Paystack (card payments)

## 1. Supabase and manager access

1. Create a project at supabase.com.
2. In the Supabase dashboard, open **SQL Editor > New query**. Open `supabase/schema.sql` in this project, copy all of it into the editor, and click **Run**. This creates the app's core tables.
3. Repeat that process with `supabase/merchant.sql`. This creates the staff access table and order fulfillment fields. Run each SQL file once, in this order.
4. Run `supabase/demo_fixes.sql` after the first two files. It adds checkout idempotency, order price snapshots, a limit on open cash-on-delivery orders, and the RLS/publication setup for live order updates.
5. In **Authentication > Providers > Email**, you can turn off **Confirm email** while testing. If it stays on, the manager must click the confirmation email before logging in.
6. Copy `.env.example` to `.env`, then set the Supabase Project URL and API key from that same project. The app accepts `VITE_SUPABASE_PUBLISHABLE_KEY` or the legacy `VITE_SUPABASE_ANON_KEY` variable.
7. Start the app and use its normal **Sign up** form to create the manager's account. This creates a regular user account; the next step grants it manager access.
8. In **SQL Editor > New query**, paste this query. Replace `manager@example.com` with the exact email used to sign up, then click **Run**. The result should contain one row with role `manager`.

   ```sql
   insert into public.restaurant_staff (user_id, role)
   select id, 'manager'
   from auth.users
   where lower(email) = lower('manager@example.com')
   on conflict (user_id)
   do update set role = excluded.role
   returning user_id, role;
   ```

9. Deploy the `api` Edge Function. It handles checkout, payment verification, and staff order operations. In a terminal opened in this project folder, run the commands below. `YOUR_PROJECT_REF` is the part before `.supabase.co` in your project URL. `login` opens a browser; `link` connects this folder to your Supabase project.

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy api
   ```

   If you previously deployed a function named `pay`, deploy `api` before releasing the updated frontend; the current app calls `api`.

10. Sign out of the app, then sign back in with the manager account. The restaurant dashboard should appear in the header.

## 2. Paystack payments (optional for manager access)

1. Create an account at paystack.com and copy your **test secret key** (Settings > API Keys & Webhooks).
2. Set it as a Supabase Edge Function secret:

   ```sh
   npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx
   ```

3. Deploy the webhook function:

   ```sh
   npx supabase functions deploy paystack-webhook --no-verify-jwt
   ```

4. In Paystack (Settings > API Keys & Webhooks), set the Webhook URL to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`.

## 3. Run
`npm install && npm run dev`

Test payments with Paystack's test cards (see their docs). Swap in the live secret key (step 3) to go live.

Prices, delivery fee and free-delivery threshold: `supabase/functions/_shared/menu.js` (the server reads the same file, so the browser can't change prices). Currency symbol: `src/data.js`.

Restaurant staff can open the dashboard from the header after logging in. Staff accounts see active paid and cash-on-delivery orders; managers can also view delivered order history. Both roles can advance orders through preparation, pickup, and delivery. Customer tracking and the staff dashboard receive live order updates, with a 20-second polling fallback. The dashboard loads orders in pages of 50.
