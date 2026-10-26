# STAGE 1: Verification & Proposed Plan Report
*(Read-only audit report — no code edits have been made)*

---

## Executive Check: Report Claims vs. Actual Running App

Before detailing the 11 items, here is the exact verification of the report claims:

| Feature / Claim | Claim in `docs/ui-ux-report.md` | Actual Codebase Reality | Evidence (File & Line) |
|---|---|---|---|
| **PDP Mobile Sticky Add-to-Cart Bar** | Claimed absent ("Mobile view lacks sticky bottom bar") | **PRESENT AND WORKING** | [product-details.html:L708-L715](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/product-details/product-details.html#L708-L715) & [product-details.css:L798-L840](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/product-details/product-details.css#L798-L840) — `.mobile-add-bar` is fixed at `bottom: 0` for viewports `< 768px`. |
| **Review Submission Form on PDP** | Claimed absent ("no way for verified customer to submit") | **PRESENT AND WORKING** | [product-details.html:L614-L656](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/product-details/product-details.html#L614-L656) & [product-details.ts:L384-L415](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/product-details/product-details.ts#L384-L415) — Full form with 1–5 star rating, comment textarea, and `ReviewPhotoPicker` for verified buyers. |
| **Mystery Box Tiers** | Claimed "Petite ₹999, Astral ₹1,999, Celestial ₹3,499" | **FALSE (Single Tier Only)** | [MysteryBoxController.cs:L25-L27](file:///d:/Rishvi/ZodiacCrystal/Zodiac%20Crystal/Zodiac%20Crystal/Controllers/MysteryBoxController.cs#L25-L27) — Backend only defines: `ItemCount = 3`, `MinValue = 2500m`, `Price = 1499m`. There are no multiple tiers. |
| **Mystery Box Zodiac Selection** | Claimed present and customizable | **TRUE AND WORKING** | [MysteryBoxController.cs:L397-L440](file:///d:/Rishvi/ZodiacCrystal/Zodiac%20Crystal/Zodiac%20Crystal/Controllers/MysteryBoxController.cs#L397-L440) & [mystery-box.ts:L27-L54](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/mystery-box/mystery-box.ts#L27-L54) — Intuitively prioritizes crystals matching `dto.ZodiacId`. |

---

## 11-Item Investigation & Proposed Actions

### 1. Homepage Testimonials & PDP Reviews
- **What the app does today**:
  - **Homepage**: There are **zero** testimonials on the homepage ([home.html:L1-L337](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/home/home.html#L1-L337)). The claim in `ui-ux-report.md` regarding a fake "Sarah M., Mumbai" review in `home.ts` was completely hallucinated.
  - **PDP Reviews**: Reviews are **not hardcoded in the HTML**. `ProductDetails` calls `this.reviewService.getReviews(productId)` ([product-details.ts:L339-L358](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/product-details/product-details.ts#L339-L358)) to fetch rows from the database. When a product has no reviews in the database, it simply shows the empty state: *"No reviews yet. Be the first to share your experience!"* ([product-details.html:L698-L701](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/product-details/product-details.html#L698-L701)).
- **Proposal**:
  - Do not hardcode any fake testimonial arrays or names in frontend components.
  - Add realistic seeded review records via [DatabaseSeeder.cs](file:///d:/Rishvi/ZodiacCrystal/Zodiac%20Crystal/Zodiac%20Crystal/Data/DatabaseSeeder.cs) (e.g. for products #1, #2, #3, linked to existing seeded customer accounts), so the already-existing `ReviewService` and review UI display real database data.

---

### 2. Unsupported Claims
- **What the app does today**:
  - `about.html` is already modest ("Connecting earthly minerals with celestial archetypes since our founding", "Every product listed here is checked for quality before it goes up for sale") ([about.html:L1-L77](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/about/about.html#L1-L77)).
  - However, [product-details.html:L181-L208](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/product-details/product-details.html#L181-L208) contains unverified claims:
    - Line 182-184: *"100% Certified Natural Gemstone · Lab-verified mineral authenticity & natural grade"*
    - Line 194-196: *"Sound & Sage Cleansed · Energized with Tibetan singing bowls before dispatch"*
    - Line 204-206: *"Ethically Sourced · Directly from certified conflict-free artisanal mines"*
  - And [compare-modal.html:L153](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/compare-modal/compare-modal.html#L153): *"Natural healing crystal, ethically sourced and cleansed."*
- **Proposal**:
  - Neutralize [product-details.html:L181-L208](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/product-details/product-details.html#L181-L208):
    - Replace with: **"Natural Mineral Specimens"** · *Hand-inspected for physical quality and crystalline character*
    - Replace with: **"Cleaned & Prepared"** · *Gently wiped and inspected before careful packaging*
    - Replace with: **"Artisanal Curation"** · *Sourced from mineral lapidaries and crystal collectors*
  - In `compare-modal.html`: *"Natural crystal specimen, inspected and carefully packed."*

---

### 3. Promo Codes `CELESTIAL` and `CRYSTAL-010`
- **What the app does today**:
  - **`CRYSTAL-010`**: **Exists as a real, working coupon.** It is seeded in [DatabaseSeeder.cs:L26-L40](file:///d:/Rishvi/ZodiacCrystal/Zodiac%20Crystal/Zodiac%20Crystal/Data/DatabaseSeeder.cs#L26-L40) (10% off), dynamically retrieved by [NewsletterController.cs:L46-L55](file:///d:/Rishvi/ZodiacCrystal/Zodiac%20Crystal/Zodiac%20Crystal/Controllers/NewsletterController.cs#L46-L55), displayed upon newsletter signup in [footer.html:L11-L24](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/footer/footer.html#L11-L24), and successfully validates at checkout via [CouponsController.cs:L309-L327](file:///d:/Rishvi/ZodiacCrystal/Zodiac%20Crystal/Zodiac%20Crystal/Controllers/CouponsController.cs#L309-L327) and `CouponValidationService.cs`.
  - **`CELESTIAL`**: **Does not exist anywhere.** It is not in the database, not in the seeder, and not even in `navbar.html` (the announcement bar at [navbar.html:L3](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/navbar/navbar.html#L3) simply says: *"Free shipping on orders over ₹999 · Cash on Delivery available · 7-day returns"* without mentioning any code).
- **Proposal**:
  - Keep `CRYSTAL-010` as the verified welcome coupon.
  - Leave `navbar.html` as is (or keep clear threshold copy); do not add `CELESTIAL` since threshold shipping applies automatically without a coupon.

---

### 4. Tracking Page Demo Simulation
- **What the app does today**:
  - In [track-order.ts:L22-L24](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/track-order/track-order.ts#L22-L24), code comments document that tracking steps are simulated from internal order status.
  - In [track-order.html:L34-L47](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/track-order/track-order.html#L34-L47), it displays `{{ o.courierName }}` and `{{ o.trackingNumber }}` entered by admin.
- **Proposal**:
  - Add a clear demo indicator badge at the top of [track-order.html](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/track-order/track-order.html):
    `<div class="track-demo-notice"><strong>Demo Simulation:</strong> Package milestones reflect simulated order progress in this demonstration store.</div>`
  - Label courier metadata neutrally: *"Courier (Demo)"* and *"Tracking Reference"*.

---

### 5. Touch Targets Under 44px at 360px Mobile
- **What the app does today**:
  - Announcement bar close button (`.announcement-close` in [navbar.css:L21-L36](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/navbar/navbar.css#L21-L36)): `padding: 0.35rem;` (measures `22x25px`).
  - Mobile menu links (`.navbar-links a` in [navbar.css:L436-L446](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/navbar/navbar.css#L436-L446)): `padding: 0.85rem 1.75rem;` (~38px height).
  - Category filter dropdowns/chips ([products.css:L124-L130](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/products/products.css#L124-L130)): `height: 42px;` and chips `padding: 0.35rem 0.85rem;` (~32px).
  - Quantity stepper buttons in cart drawer ([cart-drawer.css:L116-L126](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/cart-drawer/cart-drawer.css#L116-L126)): `32x32px` or `36x36px`.
- **Proposal**:
  - `.announcement-close`: Add `min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;`.
  - Mobile nav links: Set `min-height: 44px; display: flex; align-items: center;`.
  - Category chips/buttons on `/products`: Set `min-height: 44px;` at `< 768px`.
  - Quantity steppers: Expand touch target via `min-width: 44px; min-height: 44px;` or touch area expansion.

---

### 6. Empty Search and Empty Cart States
- **What the app does today**:
  - Empty search ([products.html:L111-L136](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/products/products.html#L111-L136)): Already shows category chips (`@for (cat of categories().slice(0, 6))`) and a "Clear All Filters" button.
  - Empty cart ([cart.html:L9-L21](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/cart/cart.html#L9-L21)): Only has "Your cart is empty" and a single button "Explore Crystals" to `/products`.
- **Proposal**:
  - In `products.html`: Add direct quick-links to "Shop by Zodiac" (`/zodiac`) and "Mystery Crystal Box" (`/mystery-box`).
  - In `cart.html`: Add an attractive quick-link row for popular collections: "Shop by Zodiac Sign", "Mystery Box", and "All Crystals".

---

### 7. Cart Free-Shipping Progress Bar
- **What the app does today**:
  - The cart drawer ([cart-drawer.html:L45-L67](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/cart-drawer/cart-drawer.html#L45-L67)) **already implements** the animated free delivery progress bar, driven by `FREE_SHIPPING_THRESHOLD = 999` from [cart.service.ts:L31](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/services/cart.service.ts#L31) (which matches [OrdersController.cs:L151](file:///d:/Rishvi/ZodiacCrystal/Zodiac%20Crystal/Zodiac%20Crystal/Controllers/OrdersController.cs#L151)).
  - The dedicated `/cart` page ([cart.html:L1-L232](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/cart/cart.html#L1-L232)) does not currently display this progress bar.
- **Proposal**:
  - Port the exact same progress bar component/markup from `cart-drawer.html` into `cart.html` right above the cart summary, reading from `cartService.total()` and `FREE_SHIPPING_THRESHOLD`.

---

### 8. "Buy Again" (Orders) & "Move All to Cart" (Wishlist)
- **What the app does today**:
  - Order history ([orders.html:L74-L91](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/orders/orders.html#L74-L91)): Actions are only "View Order", "Track Package" (if shipped), and "Cancel Order".
  - Wishlist ([wishlist.html:L33-L37](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/wishlist/wishlist.html#L33-L37)): Cards have individual "Add to Cart" or "Remove", but no bulk header action.
- **Proposal**:
  - In `orders.html`: Add a "Buy Again" button for each line item (or order-level action) that calls `cartService.addToCart(product, item.quantity)`, triggers the toast notification, and opens the cart drawer.
  - In `wishlist.html`: In the header next to the gem count pill, add a "Move all to cart" button that iterates over in-stock items, calls `cartService.addToCart()`, and presents a confirmation toast.

---

### 9. Product Filters (Price Range & In-Stock Only)
- **What the app does today**:
  - The backend [ProductsController.cs:L61-L107](file:///d:/Rishvi/ZodiacCrystal/Zodiac%20Crystal/Zodiac%20Crystal/Controllers/ProductsController.cs#L61-L107) **already implements** `minPrice`, `maxPrice`, and `inStockOnly`.
  - The frontend [products.html:L46-L60](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/products/products.html#L46-L60) and [products.ts:L155-L172](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/pages/products/products.ts#L155-L172) **already have** the Price Range selector (`Any Price`, `Under ₹500`, `₹500 - ₹1000`, `₹1000 - ₹2000`, `Above ₹2000`) and the `In stock only` checkbox wired to `loadProducts()`.
- **Proposal**:
  - Do not invent any new query parameters.
  - Refine the styling and spacing of these existing inputs so they wrap gracefully on 360px mobile without clipping.

---

### 10. Auto-Fill City/State from 6-digit PIN via India Post
- **What the app does today**:
  - [india-address.util.ts:L76-L100](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/utils/india-address.util.ts#L76-L100) already queries `https://api.postalpincode.in/pincode/{pin}`.
  - [map-address-fields.ts:L54-L97](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/map-address-fields/map-address-fields.ts#L54-L97) (`onPinInput`) already executes `check(true)` which auto-fills:
    ```ts
    this.state.set(places[0].state);
    this.city.set(places[0].city);
    ```
  - However, in [map-address-fields.html:L20-L24](file:///d:/Rishvi/ZodiacCrystal/Frontend/src/app/components/map-address-fields/map-address-fields.html#L20-L24), the State/City selector is rendered *above* the PIN code field, so users often fill State and City manually first.
- **Proposal**:
  - Reorder the fields in `map-address-fields.html` so the PIN Code field appears before State and City, and add a subtle confirmation label when auto-filled (e.g. *"✓ Auto-filled City & State"*).

---

### 11. Small "Demo Store" Notice
- **What the app does today**:
  - No customer-facing banner explicitly states that payments and shipments are in demonstration mode.
- **Proposal**:
  - Add an unobtrusive, tasteful header chip or announcement bar note:
    `"Demo Store · Simulated checkout & tracking · No real payments processed"`

---

## Constraints Respected
- Contrast tokens: **Not modified** (`--color-subtle` left untouched at 5.1:1 on canvas).
- Payment, order, and auth logic: **Untouched**.
- New packages: **None**.
- All data verified against real codebase lines.
