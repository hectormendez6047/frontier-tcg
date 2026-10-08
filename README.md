# Frontier TCG — online store

The website for Frontier TCG (frontiertcgshop.com): storefront, Card Finder, cart, and a store admin for products, photos, prices, stock, CSV import/export, rewards, events and settings.

**Stage 1 (this version):** everything except taking payments. Checkout shows totals but the “Place order” button stays off until Square is connected in stage 2.

---

## Setup, step by step

You need three free accounts: **GitHub** (holds the code), **Supabase** (database, logins, photos) and **Vercel** (hosts the site). Never paste passwords or secret keys into a chat. Each one goes only where a step below says.

### 1. Set up the database (Supabase, about 5 minutes)

1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In the left menu, click **SQL Editor**, then **New query**.
3. Open the file `supabase/migrations/0001_init.sql` from this project, copy everything in it, paste it into the editor and click **Run**. You should see “Success. No rows returned”.
4. Optional, for testing: make another new query, paste in `supabase/seed.sql` and click **Run**. This adds 13 demo products marked “Demo” and one example event. You can delete them later from the admin.

### 2. Create your owner login

1. In Supabase, go to **Authentication → Users → Add user → Create new user**.
2. Enter your email and a strong password, tick **Auto Confirm User**, and click **Create user**.
3. Go back to **SQL Editor → New query**, paste this with your real email, and click **Run**:

   ```sql
   update public.profiles set role = 'owner' where email = 'you@example.com';
   ```

   It should say “1 row affected”. If it says 0, check the email matches exactly.

### 3. Copy your Supabase keys

In Supabase go to **Project Settings → API** (or **Data API**) and keep that tab open. You need:

- **Project URL**, which looks like `https://abcdefgh.supabase.co`
- **anon public** key, which may be labeled **publishable** key. This one is safe to use in a website.

Do **not** use the `service_role` or **secret** key anywhere. The site doesn't need it.

### 4. Put the site online (Vercel, about 5 minutes)

1. Go to [vercel.com/new](https://vercel.com/new) and import the `frontier-tcg` GitHub repository.
2. Before clicking Deploy, open **Environment Variables** and add these three:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from step 3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key from step 3 |
   | `NEXT_PUBLIC_SITE_URL` | `https://frontiertcgshop.com` |

3. Click **Deploy**. When it finishes, Vercel gives you a web address like `frontier-tcg.vercel.app`.
4. If the build fails, copy the red error lines from the build log and send them to Claude to fix.

### 5. Tell Supabase where the site lives

In Supabase go to **Authentication → URL Configuration**:

- **Site URL:** your Vercel address for now, for example `https://frontier-tcg.vercel.app`. Change it to `https://frontiertcgshop.com` once the domain is connected.
- **Redirect URLs:** add both `https://frontier-tcg.vercel.app/**` and `https://frontiertcgshop.com/**`.

This makes password-reset emails link back to your site.

### 6. Sign in and start managing the store

Go to `your-site/login`, sign in with the owner login from step 2, and you'll land in **Store admin**. You can also reach it from the list icon in the header whenever you're signed in.

### 7. Connect frontiertcgshop.com (later)

In Vercel: **Project → Settings → Domains → Add** `frontiertcgshop.com`. Vercel shows one or two DNS records. Add them in Cloudflare under **DNS → Records**, with the proxy status set to **DNS only** (grey cloud). The padlock (HTTPS) is set up automatically.

---

## Using the admin

| Task | Where |
|---|---|
| Add a product with photos | Products → Add product. Drag photos onto the box. The first photo is the main one. |
| Change a price or quantity | Products → type in the Price or Qty box → press Enter. It saves immediately. |
| Replace or reorder photos | Products → Edit → use Main, ←, → or Delete under each photo → Save changes |
| Change many products at once | Products → tick the boxes → use the gold bar: set price, adjust by %, set quantity, archive, delete… |
| Import or update from a spreadsheet | Import / Export → drop a .csv → check the preview → Apply. Rows with an existing SKU update that product. |
| Download your inventory | Import / Export → Export all products |
| Rewards | Rewards → Add member, open a member to record a purchase, redeem, or adjust points |
| Turn on local pickup / change the fee | Settings → Checkout |
| Homepage text and announcement | Settings → Homepage |
| Featured products | Edit a product → tick “Feature on homepage” |
| Give an employee access | Invite them in Supabase (Authentication → Users → Invite), then Team → enter their email and pick Staff or Admin |
| See who changed what | Activity log |

**Roles**

- **Staff:** edit prices, stock and existing products, run rewards and manage events.
- **Admin:** everything staff can do, plus add, import and delete products and change settings.
- **Owner:** everything, plus manage the team.

Permissions are enforced by the database itself, not just hidden in the page.

---

## For developers

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage), deployed on Vercel.
- **Run locally:** `cp .env.example .env.local`, fill in the values, then `npm install` and `npm run dev`.
- **Database:** `supabase/migrations/0001_init.sql` is idempotent, so it's safe to re-run. It creates tables, roles, row-level security, search functions, the audit trigger and the `product-images` storage bucket.
- **Search:** `search_products()` uses a trigram-indexed, accent-folded `search_text` column. It was tested at 50,000 products with searches around 100–130 ms on a small machine.
- **Security model:**
  - Shoppers (anon and customers) can read only public product columns. Cost, notes and raw stock counts are column-revoked, and staff read full rows through `admin_*` security-definer functions that check the caller's role.
  - Every write goes through server actions that re-check the role, on top of row-level security.
  - Price, stock and status changes are logged by a database trigger, whichever screen made them.
- **Stage 2 hooks:** `products.square_catalog_id`, `rewards_members.square_customer_id` and the commented `SQUARE_*` variables in `.env.example`. Orders and checkout tables come with stage 2.
- **Known limits in stage 1:**
  - There are no orders or payments yet.
  - Newsletter sign-up is hidden until an email provider is connected.
  - Photos uploaded and then abandoned without saving stay in storage. They're harmless and can be cleaned up from Supabase Storage.
