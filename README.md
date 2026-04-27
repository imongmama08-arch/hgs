# REWEAR PROJECT — COMPLETE SUMMARY
> Last updated: April 27, 2026

---

## TABLE OF CONTENTS
1. [Database Setup](#database-setup)
2. [Admin Dashboard](#admin-dashboard)
3. [Seller Dashboard](#seller-dashboard)
4. [Checkout Flow](#checkout-flow)
5. [Buyer Dashboard](#buyer-dashboard)
6. [Live Camera Verification](#live-camera-verification)
7. [DB Editor](#db-editor)
8. [All Files Changed](#all-files-changed)
9. [Things Still To Do](#things-still-to-do)
10. [How To Test](#how-to-test)

---

## DATABASE SETUP

**File:** `sql/RUN_THIS_IN_SUPABASE.sql`

### How to run
1. Go to [supabase.com](https://supabase.com) → your project
2. Click **SQL Editor** → **New Query**
3. Open `sql/RUN_THIS_IN_SUPABASE.sql`, copy everything, paste, click **Run**

### What it creates
| Table | Purpose |
|---|---|
| `products` | All product listings |
| `sellers` | Seller accounts and verification status |
| `orders` | Buyer orders |
| `listing_fees` | Seller tier fees |
| `transactions` | Commission tracking per order |
| `earnings` | Platform revenue ledger |
| `blog_posts` | Blog articles |
| `newsletter_subscribers` | Email subscribers |
| `contact_messages` | Contact form submissions |
| `admin_sessions` | Admin PIN storage |
| `buyers` | Buyer profiles |
| `buyer_addresses` | Buyer shipping addresses |
| `wishlists` | Buyer wishlists |

### Key details
- **Safe to run multiple times** — uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- **Drops and recreates all RLS policies** on every run (no duplicate policy errors)
- **Seeds sample data:** 12 products, 9 blog posts, 3 sellers, 2 orders
- **Admin PIN:** `1234` (stored as SHA-256 hash in `admin_sessions`)

### Other SQL files
| File | Purpose |
|---|---|
| `sql/00_reset.sql` | Drops ALL tables — use only for clean slate |
| `sql/01_store.sql` | Products + blog tables only |
| `sql/02_users.sql` | Sellers + orders tables only |
| `sql/03_admin.sql` | Admin sessions table only |
| `sql/04_marketplace.sql` | Listing fees + transactions + earnings |
| `sql/05_critical_fixes.sql` | Constraints, indexes, atomic functions |

---

## ADMIN DASHBOARD

**Files:** `pages/admin.html`, `js/admin.js`

### Access
- URL: `pages/admin.html`
- PIN: `1234`
- Stays logged in across page refreshes (uses `localStorage`)

### Tabs

#### Overview
- Shows 4 stat cards: Pending Sellers, Pending Listings, Total Orders, Total Sellers
- "Needs Attention" list — top 5 pending sellers and listings with quick approve/reject

#### Seller Verification
- Lists all sellers with status filter (All / Pending / Verified)
- Search by name or email
- Approve → sets `verified = true`, `verified_at = now()`
- Reject → prompts for reason, stores in `rejection_reason`
- Revoke → removes verification from already-approved seller

#### Listing Approvals
- Shows all products as cards with image, bold price, category, sizes, status badge
- Filter by status (All / Pending / Approved / Rejected)
- Search by product name
- Approve → sets `status = 'approved'`, `in_stock = true`
- Reject → prompts for reason, sets `status = 'rejected'`, `in_stock = false`
- Re-approve → available for rejected listings

#### All Orders
- Lists all orders with buyer info, product, price, status badge
- Status dropdown to update: pending → confirmed → shipped → delivered → received → cancelled

#### Platform Earnings
- Shows Listing Fees total, Commissions total, Grand Total Revenue

### DB Error Banner
- If Supabase tables are missing or RLS blocks access, a **red banner** appears at the top
- Banner says: "Run `sql/RUN_THIS_IN_SUPABASE.sql` in Supabase SQL Editor"

### What was fixed
- Tab switching was broken — JS looked for `.nav-item` but HTML uses `.sb-link`
- `loadListings()` was not defined — only a demo version `loadListingsEnhanced()` existed
- `admin-enhanced.js` used hardcoded fake data — removed from HTML
- Admin session was lost on refresh — changed from `sessionStorage` to `localStorage`
- All missing functions added: `loadSellers()`, `loadOrders()`, `loadAdminEarnings()`

---

## SELLER DASHBOARD

**Files:** `pages/dashboard-seller.html`, `js/dashboard-seller.js`, `js/script.js`

### Product Submission Fix
**Root cause:** `script.js` had its own form handler that inserted products **without `seller_id`** and with `in_stock: true`, no `status` field. So the seller's listings tab found nothing because `seller_id = NULL`.

**Fix:**
- `script.js` now sets `seller_id`, `status: 'pending'`, `in_stock: false`
- Added `window._dashboardSellerLoaded = true` flag in `dashboard-seller.js`
- `script.js` skips attaching its handler if `dashboard-seller.js` is already loaded

### My Listings Tab
Products now show with colored status badges:
| Badge | Meaning |
|---|---|
| ⏳ Pending Review (orange) | Submitted, waiting for admin |
| ✅ Approved (green) | Live in shop |
| ❌ Rejected (red) | Rejected by admin |

- Rejection reason shown to seller in red box
- Placeholder shown if no image URL

### Correct Insert Payload
```javascript
{
  seller_id:  currentSellerId,   // ✅ now set
  name:       '...',
  price:      0.00,
  category:   '...',
  image_url:  '...',
  description:'...',
  sizes:      ['S','M','L'],
  in_stock:   false,             // ✅ false until admin approves
  status:     'pending'          // ✅ requires admin approval
}
```

---

## CHECKOUT FLOW

**Files:** `pages/checkout.html`, `js/checkout.js`

### Steps
1. **Order Details** — fill name, phone, address → "Choose Payment Method"
2. **Payment Method** — pick GCash or COD → "Continue"
3. **GCash** → upload screenshot → "Submit Payment Proof"
   **COD** → review details → "Confirm COD Order"
4. **Confirmation** → auto-redirects to buyer dashboard in 4 seconds

### Functions Added (were missing/undefined)
| Function | What it does |
|---|---|
| `proceedToPaymentMethod()` | Validates delivery form, creates order in DB, goes to step 2 |
| `proceedWithPayment()` | Routes to GCash or COD step based on selection |
| `selectPaymentMethod(method)` | Highlights selected payment card |
| `confirmCODOrder()` | Updates order status to confirmed, shows confirmation |

### File Upload Fix
- Clicking the upload area now opens the **native file picker**
- On mobile: shows camera + gallery options (`accept="image/*"`)
- Drag & drop works on desktop
- Shows image preview after selecting with filename and size
- "Change Screenshot" button to pick a different file
- Submit button only enables after file is selected

### Redirect After Confirmation
- Auto-redirects to `dashboard-buyer.html` after 4 seconds
- Shows countdown: "Redirecting to your dashboard in X seconds..."
- "Go to My Dashboard" button for immediate redirect
- "Track Your Order" link goes to `order-tracking.html?id=...`

### Email Field
- No `buyerEmail` field in the HTML form
- JS now gets email automatically from `authManager.getCurrentUser()?.email`
- Falls back to `buyer@rewear.com` if not logged in

---

## BUYER DASHBOARD

**File:** `pages/dashboard-buyer.html`

- After order placed → redirects here automatically
- Track Order link → `order-tracking.html?id={orderId}`
- From here, buyer can click Shop to browse more items

---

## LIVE CAMERA VERIFICATION

**Files:** `js/live-camera-verification.js`, `js/face-verification.js`

### What it does
- Captures 4 photos: front, left, right, front again
- Guides user with on-screen instructions
- Saves all 4 photos to `localStorage` for admin review

### Fix: "No face detected in selfie" error
**Root cause:** Code required a government ID to be uploaded first, then tried face-api.js comparison. If no ID or face-api failed, it crashed.

**Fix:**
- Always saves the 4 captured photos regardless of face-api result
- Shows "Pending Admin Review" instead of crashing
- Only tries face-api comparison if government ID is actually uploaded AND face-api is loaded
- Admin sees all 4 photos and reviews manually

### Admin Verification View
- Admin clicks "📸 View Captured Images" on a seller card
- Modal shows government ID photo vs 4 live camera captures side-by-side
- AI confidence score shown (if face-api ran)
- "✅ Approve Based on Live Verification" button for quick approval
- "📄 Download Report" exports verification data as JSON

---

## DB EDITOR

**File:** `pages/db-editor.html`

### Access
- URL: `pages/db-editor.html`
- PIN: `1234` (same as admin)
- Accessible from admin sidebar → "DB Editor" button

### Features
- Sidebar shows all 13 tables with live row counts
- Click any table → see all rows in a dark-themed grid
- **Search** — filter rows across all columns instantly
- **Edit rows** — click Edit, change values, save
- **Add rows** — smart field forms per table
- **Delete rows** — with confirmation prompt
- **Pagination** — 50 rows per page
- Color badges for status, verified, boolean fields
- Error message if table doesn't exist (run SQL first)

---

## ALL FILES CHANGED

| File | What Changed |
|---|---|
| `js/admin.js` | Complete rewrite — all tabs working with real DB data |
| `js/dashboard-seller.js` | Fixed listing display, colored status badges, `_dashboardSellerLoaded` flag |
| `js/script.js` | Fixed product insert — now sets `seller_id`, `status: 'pending'`, `in_stock: false` |
| `js/checkout.js` | Added 5 missing functions, fixed file upload, fixed redirect to dashboard |
| `js/live-camera-verification.js` | No longer crashes when face-api fails, always saves photos |
| `js/local-auth.js` | Fixed `clearAuthState` to not clear admin localStorage session |
| `pages/admin.html` | Removed `admin-enhanced.js`, added DB Editor link in sidebar |
| `pages/checkout.html` | Fixed upload area click, redirect buttons go to dashboard |
| `pages/db-editor.html` | **New file** — full database table editor |
| `css/style.css` | Added live verification modal styles, checkout payment card styles |
| `sql/RUN_THIS_IN_SUPABASE.sql` | Complete safe database setup (rewrote to use IF NOT EXISTS) |
| `sql/00_reset.sql` | **New file** — drops all tables for clean slate |

---

## THINGS STILL TO DO

- [ ] **Run the SQL** — `sql/RUN_THIS_IN_SUPABASE.sql` in Supabase (database is empty after reset)
- [ ] **Seller GCash number** — currently shows "Contact seller", needs seller profile field for GCash number
- [ ] **Image upload** — currently uses URL input, needs Cloudinary or Supabase Storage integration
- [ ] **Email notifications** — notify seller when listing approved/rejected, notify buyer when order confirmed
- [ ] **Buyer dashboard** — order history list needs to be wired to real DB data
- [ ] **Order tracking page** — real-time status updates from DB
- [ ] **Seller verification flow** — admin comparing government ID vs live camera photos (UI built, needs testing)
- [ ] **Listing fee enforcement** — currently skipped for testing, needs to be re-enabled
- [ ] **Search on shop page** — full-text search using `search_vector` column (already indexed in DB)
- [ ] **Wishlist** — localStorage-based, needs to sync to `wishlists` table when user is logged in

---

## HOW TO TEST

### 1. Set up database
```
Supabase → SQL Editor → New Query → paste sql/RUN_THIS_IN_SUPABASE.sql → Run
```
Expected result: table showing 12 products, 9 blog posts, 3 sellers, 2 orders

### 2. Test admin
```
Open pages/admin.html → PIN: 1234
```
- Overview tab → should show stats
- Sellers tab → should show 3 sellers (2 pending, 1 verified)
- Listings tab → should show 12 products
- Orders tab → should show 2 orders

### 3. Test seller flow
```
Sign up as seller → log in → go to dashboard-seller.html
```
- Add a listing → should appear in My Listings with "⏳ Pending Review"
- Go to admin → Listings tab → approve it
- Check shop → product should appear

### 4. Test buyer flow
```
Sign up as buyer → go to shop.html → click Buy Now on any product
```
- Fill delivery form → Choose Payment Method
- Pick GCash → upload a screenshot → Submit
- Should redirect to dashboard-buyer.html after 4 seconds

### 5. Test DB editor
```
Open pages/db-editor.html → PIN: 1234
```
- Click any table → rows should load
- Edit a row → save → should update in Supabase

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Database | Supabase (PostgreSQL) |
| Auth | Custom localStorage-based auth (no Supabase Auth) |
| Face Verification | Face-api.js (@vladmandic/face-api) |
| Image CDN | Unsplash (seeded), Cloudinary (planned) |
| Payments | GCash (manual screenshot upload), COD |

---

## SUPABASE PROJECT

- **URL:** `https://jtprrhppsleunzjbolbp.supabase.co`
- **Anon Key:** stored in `api/supabase.js`
- **Admin PIN:** `1234`
- **RLS:** All tables use `anon` role policies (no Supabase Auth yet)
