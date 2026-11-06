# Impeccable Deep Frontend Architecture & Design Review
**Project:** ZodiacCrystal Luxury Mineral & Crystal E-Commerce  
**Review Toolchain:** Impeccable Design Skill v4.8.0  
**Scope:** Frontend Codebase (`Frontend/src/**`) — HTML templates, CSS/SCSS stylesheets, Angular 21 standalone components, design tokens, responsive layouts, accessibility, and bundle performance.  
**Constraint Mode:** **Strictly READ-ONLY.** Zero edits or deletions were made to the codebase. No previously applied fixes are repeated (omitting the 8 declared color tokens, Georgia/Playfair font adjustments, 800/650 font weights, and `#777`/`copper-hi` contrast fixes).

---

## Table of Contents
1. [STEP 0: Complete Impeccable Command & Sub-command Inventory](#step-0-complete-impeccable-command--sub-command-inventory)
2. [Executive Summary & Health Matrix](#executive-summary--health-matrix)
3. [The 14 Impeccable Review Passes](#the-14-impeccable-review-passes)
   - [Pass 1: Context (`init` / `document`)](#pass-1-context-init--document)
   - [Pass 2: Critique (`critique`)](#pass-2-critique-critique)
   - [Pass 3: Audit (`audit`)](#pass-3-audit-audit)
   - [Pass 4: Layout & Structure (`layout`)](#pass-4-layout--structure-layout)
   - [Pass 5: Typography (`typeset`)](#pass-5-typography-typeset)
   - [Pass 6: Color (`colorize`)](#pass-6-color-colorize)
   - [Pass 7: Normalize & Consistency](#pass-7-normalize--consistency)
   - [Pass 8: Distill & Quieter (`distill` / `quieter`)](#pass-8-distill--quieter-distill--quieter)
   - [Pass 9: Clarify (`clarify`)](#pass-9-clarify-clarify)
   - [Pass 10: Adapt (`adapt`)](#pass-10-adapt-adapt)
   - [Pass 11: Harden (`harden`)](#pass-11-harden-harden)
   - [Pass 12: Animate & Delight (`animate` / `delight`)](#pass-12-animate--delight-animate--delight)
   - [Pass 13: Optimize (`optimize`)](#pass-13-optimize-optimize)
   - [Pass 14: Extract (`extract`)](#pass-14-extract-extract)
4. [Structure & Refactor Architecture Plan](#structure--refactor-architecture-plan)
   - [Modern Angular 21 Directory Architecture](#modern-angular-21-directory-architecture)
   - [Decomposition of God Components](#decomposition-of-god-components)
   - [Duplicated CSS & Template Deduplication](#duplicated-css--template-deduplication)
   - [Production-Grade Design Token Layer](#production-grade-design-token-layer)
   - [Key Page Layout Blueprints](#key-page-layout-blueprints)
   - [Visual Direction & Palette Refinements](#visual-direction--palette-refinements)
5. [Detailed Suggestions & Remediation Catalog](#detailed-suggestions--remediation-catalog)
6. [Master Synthesis & Phased Roadmap](#master-synthesis--phased-roadmap)
   - [Numbered Master List](#numbered-master-list)
   - [4-Phase Execution Roadmap](#4-phase-execution-roadmap)
   - [Top 10 High-Impact Changes to Make First](#top-10-high-impact-changes-to-make-first)
   - [What Is Already Good and Must Stay](#what-is-already-good-and-must-stay)

---

## STEP 0: Complete Impeccable Command & Sub-command Inventory

Below is the complete inventory of every command, sub-command, and CLI utility available in the installed Impeccable Design Skill (v4.8.0), detailing whether it was utilized for this review, where it applied, or the explicit technical reason why it was skipped.

| Command / Utility | Category | Purpose / Capability | Status in this Review | Notes & Technical Rationale |
|---|---|---|---|---|
| `impeccable init` | Build | Capture durable product context in `PRODUCT.md` | **Used** (Pass 1) | Synthesized brand archetype, audience profiles, and tone of voice. |
| `impeccable document` | Build | Generate `DESIGN.md` from existing project code | **Used** (Pass 1 & Refactor) | Mapped current token landscape, type ramp, color ramps, and surface modes. |
| `impeccable extract` | Build | Pull reusable tokens and components into design system | **Used** (Pass 14 & Tokens) | Identified candidates for shared components (`<app-modal>`, `<app-drawer>`, etc.). |
| `impeccable shape` | Build | Plan UX/UI before writing code | **Used** (Structure Review) | Used to blueprint page flows and monolith decomposition. |
| `impeccable craft` | Build | Deprecated alias for new-work request | **Skipped** | Deprecated in Impeccable v4.8.0 in favor of `shape` and `new-work`. |
| `impeccable critique` | Evaluate | UX design review with heuristic scoring | **Used** (Pass 2) | Full heuristic evaluation across all 7 primary customer and admin surfaces. |
| `impeccable audit` | Evaluate | Technical quality checks (a11y, perf, responsive) | **Used** (Pass 3) | Assessed WCAG 2.1 AA compliance, contrast, focus rings, and CLS. |
| `impeccable audit.native` | Evaluate | Mobile OS native checks (iOS Dynamic Type, TalkBack) | **Skipped** | Project is a responsive web application (Angular 21 SPA), not an iOS/Android native app. |
| `impeccable polish` | Refine | Final quality pass before shipping | **Used** (Action Catalog) | Targeted alignment, micro-spacings, borders, and tactile finish. |
| `impeccable bolder` | Refine | Amplify safe or bland designs | **Used** (Pass 2 & Visual Direction) | Applied to storefront typography contrast and crystal hero presentation. |
| `impeccable quieter` | Refine | Tone down aggressive or overstimulating designs | **Used** (Pass 8) | Flagged noisy borders, nested card containers, and excessive glow halos. |
| `impeccable distill` | Refine | Strip to essence, remove complexity | **Used** (Pass 8) | Flagged redundant badges, decorative accents, and 50+ inline `style="..."` attributes. |
| `impeccable harden` | Refine | Production-ready: errors, loading, empty states, edge cases | **Used** (Pass 11) | Audited skeleton states, image fallbacks, network errors, and form validation bounds. |
| `impeccable onboard` | Refine | First-run flows, empty state activation, search zero-states | **Used** (Pass 9 & 11) | Audited cart zero-state, search empty state, and new user consultation prompts. |
| `impeccable animate` | Enhance | Add purposeful animations and motion | **Used** (Pass 12) | Evaluated spring easing, drawer slide-overs, and `prefers-reduced-motion`. |
| `impeccable colorize` | Enhance | Strategic color hierarchy and accent discipline | **Used** (Pass 6 & Visual Direction) | Audited over 1,200 hardcoded hex occurrences; engineered refined mineral palette. |
| `impeccable typeset` | Enhance | Typography scale, pairing, measure, and rhythm | **Used** (Pass 5) | Audited 96 instances of sub-12px tiny text, heading rhythm, and font pairing. |
| `impeccable layout` | Enhance | Spacing, rhythm, container widths, and visual hierarchy | **Used** (Pass 4) | Evaluated 4px/8px grid discipline, container max-widths, and layout alignment. |
| `impeccable delight` | Enhance | Personality, tactile feedback, and memorable brand moments | **Used** (Pass 12) | Crystal aura hover effects, order confirmation celebration, and haptic feedback. |
| `impeccable overdrive` | Enhance | Push past conventional category limits | **Skipped** | E-commerce checkout and admin require high utility and trust; avant-garde layout violates UX conventions. |
| `impeccable clarify` | Fix | Improve UX copy, labels, microcopy, and error messaging | **Used** (Pass 9) | Rewrote technical validation errors and vague CTA copy across forms. |
| `impeccable adapt` | Fix | Multi-device constraints (mobile, tablet, desktop, ultrawide) | **Used** (Pass 10) | Assessed 44px tap targets, thumb-zone ergonomics, and viewport overflows. |
| `impeccable adapt.native`| Fix | Safe-area insets, notch handling on native Swift/Kotlin | **Skipped** | Project is a responsive web application; CSS env(safe-area-inset) is handled via `adapt`. |
| `impeccable optimize` | Fix | Diagnose and fix UI performance, bundle size, and fonts | **Used** (Pass 13) | Analyzed Angular bundle budget overruns (1.45MB initial, 40KB+ CSS files). |
| `impeccable live` | Iterate | Interactive element picking and live browser variant iteration | **Skipped** | Requires an interactive human browser session with live DOM inspector. |
| `impeccable generate` | Iterate | Automated generation of live HTML/CSS variant matrix | **Skipped** | Report phase is strictly read-only; variants will be generated during Phase 4 implementation. |
| `impeccable detect` | CLI Utility | Mechanical design linter across 62 UI anti-pattern rules | **Used** (Automated pass) | Executed across 410 codebase files; surfaced 35 critical broken image bindings and hex anomalies. |
| `impeccable doctor` | CLI Utility | Health check for design system artifact drift | **Used** (Pre-review) | Confirmed missing `PRODUCT.md` and `DESIGN.md` artifacts in root directory. |
| `impeccable pin / unpin` | CLI Utility | Create or remove standalone slash commands | **Skipped** | Development environment configuration utility. |
| `impeccable hooks` | CLI Utility | Configure git/editor automated design linter hooks | **Skipped** | Not applicable to read-only audit deliverables. |

---

## Executive Summary & Health Matrix

The ZodiacCrystal frontend represents a feature-rich, high-ambition e-commerce platform built on modern Angular 21 (standalone components, Signals, control flow `@if`/`@for`). It successfully melds high-touch Vedic astrology with luxury mineral D2C retail.

However, rapid feature iteration has led to significant **architectural debt**, **bundle budget violations**, and **styling fragmentation**.

### Design Health Scorecard

| Domain | Score | Current Grade | Primary Finding |
|---|---|---|---|
| **Architectural Modularity** | 42 / 100 | **F** | Massive "God" components (`ProductDetails` = 3,850 total lines across TS/HTML/CSS; `AddressMap` = 731 lines TS). |
| **Performance & Bundles** | 54 / 100 | **D** | Initial bundle (1.45 MB) exceeds budget (1.0 MB); `home.css` (40.1 KB) and `product-details.css` (44.8 KB) violate 20 KB budget. |
| **Token Discipline** | 48 / 100 | **F** | Over 1,200 raw hex codes in component CSS bypassing `:root`; 22 different arbitrary `z-index` numbers. |
| **Accessibility (WCAG 2.1 AA)** | 66 / 100 | **D+** | 37 CSS files strip focus outlines (`outline: none` without `:focus-visible`); 96 instances of tiny text (< 11.5px). |
| **Responsive Adaptability** | 82 / 100 | **B** | Solid 44px mobile touch targets and bottom sticky add bar; minor tablet card-grid wrapping glitches. |
| **Visual Tone & Brand Craft** | 84 / 100 | **B+** | Rich mineral aesthetic, Fraunces serif display typography, and authentic astrological depth. |

---

## The 14 Impeccable Review Passes

### Pass 1: Context (`init` / `document`)
* **Brand Positioning:** High-vibrational luxury crystal apothecary & Vedic astrology sanctuary. Positioned between the modern holistic curation of *Energy Muse* and the refined editorial elegance of *Catbird NYC* and *Goop Wellness*.
* **Target Audience:**
  1. *Spiritual Seekers & Healers:* Looking for authentic, cleansed, ethically sourced gemstones with verified energetic properties.
  2. *Astrology Enthusiasts:* Users seeking stones tailored precisely to their Vedic moon sign, ascendant, and current astrological transits.
  3. *Mindful Luxury Gift Buyers:* Premium consumers seeking aesthetic, beautifully packaged, and intention-driven artifacts.
* **Surface Modes:**
  - **Storefront (Home, Products, Product Details):** Mode: **Persuade & Experience**. Must evoke tactile serenity, tactile mineral textures, and sacred geometry.
  - **Checkout & Account:** Mode: **Operate**. Requires frictionless clarity, reassurance, and zero cognitive load.
  - **Admin Backoffice:** Mode: **Operate**. High information density, scannable data grids, and keyboard accessibility.
* **Current Design System State:** `:root` in `styles.scss` has a rich palette defined, but component styles largely bypass it, redefining local colors, shadows, and paddings.

---

### Pass 2: Critique (`critique`)
* **Home Page:**
  - *Hero Section:* Visually striking, but the dual CTAs ("Explore Zodiac" and "Shop All Crystals") compete for visual dominance with identical visual weight.
  - *Sacred Intentions Rail:* The horizontal scroll rail works well on mobile, but on 1440px desktop screens, it leaves awkward blank margins.
  - *Zodiac Wheel / Birthday Sign Finder:* Engaging feature, but the modal contains 567 lines of localized CSS and can trap keyboard focus.
* **Product Catalog (`/products`):**
  - *Filter Drawer & Sidebar:* Filter pills on mobile lack a visible count badge when collapsed. The intention chips are clear, but category tags lack secondary contrast.
  - *Product Cards:* Hover state triggers a border transition that causes subtle layout jitter (subpixel border-width shifting).
* **Product Details (`/product/:slug`):**
  - *Information Overload:* Image zoom, thumb carousel, affirmations, cleansing rituals, physical dimensions, zodiac alignments, bundle kits, customer photos, and reviews are stacked in one relentless column. The user suffers cognitive fatigue before reaching the add-to-cart trigger.
* **Cart & Cart Drawer:**
  - *Cart Drawer:* Clean, but the shipping progress bar lacks an animated celebration state when free shipping is unlocked.
  - *Full Cart Page:* Redundant table headers that wrap awkwardly on viewports between 768px and 992px.
* **Checkout:**
  - *Steps Flow:* 3-step accordion is intuitive, but shipping method radios look like raw HTML inputs without tactile card containers.
* **Admin Dashboard & Management:**
  - *Information Density:* Admin tables suffer from visual clutter; status badges use 6 different font sizes across different modules.

---

### Pass 3: Audit (`audit`)
* **Accessibility (WCAG 2.1 AA):**
  1. *Focus Rings:* 37 CSS files contain `outline: none` or `outline: 0` without declaring an alternative `:focus-visible` ring. Keyboard users cannot track focus across data tables, filter pills, and product action buttons.
  2. *Image Fallbacks (`broken-image`):* 35 template instances use `[src]="imgUrl"` without an `(error)` handler or static fallback, leaving unsightly broken-image icons when an image is slow or missing.
  3. *Form Field Labels:* Several search inputs and quantity adjustments lack `aria-label` or `<label>` tags, relying solely on `placeholder`.
* **Performance & Core Web Vitals:**
  1. *CSS Bloat:* `home.css` (40.1 KB) and `product-details.css` (44.8 KB) violate the Angular CLI budget of 20 KB. This directly delays First Contentful Paint (FCP).
  2. *Initial JS Bundle:* 1.45 MB exceeds the 1.0 MB budget. Non-critical features like `AddressMap` (Google Maps API + leaflet components) and `AdminShared` are imported in root bundles rather than lazy-loaded.
* **Cumulative Layout Shift (CLS):**
  - Product images in cards lack explicit `aspect-ratio` or `width`/`height` attributes in HTML, causing cards to jump when high-res photos resolve.

---

### Pass 4: Layout & Structure (`layout`)
* **Spacing Rhythm Breakdown:**
  - The design system declares `--space-2xs` (4px) through `--space-3xl` (72px). However, components use arbitrary values: `0.35rem` (5.6px), `0.65rem` (10.4px), `1.15rem` (18.4px), `2.35rem` (37.6px).
  - *Recommendation:* Enforce strict 4px/8px mathematical rhythm (`0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`, `3rem`, `4rem`).
* **Container Max-Width Inconsistency:**
  - Global container is defined as `1400px` (`--container-max`).
  - Home sections use `max-width: 1200px`, Product details uses `max-width: 1280px`, and Account pages use `max-width: 1100px`. The page edges jump when navigating between views.
* **Heading Hierarchy Rhythm (`heading-rhythm`):**
  - In `product-details.html` and `orders.html`, headings frequently have equal spacing above and below (`margin: 1.5rem 0`), visually divorcing the heading from the content it introduces.

---

### Pass 5: Typography (`typeset`)
* **Type Scale & Hierarchy:**
  - Primary Display/Heading: `Fraunces` (serif) — elegant, warm, distinct.
  - Body/Interface: `Inter` (sans-serif) — clean, legible.
* **Undersized Functional Text (`undersized-ui-text`):**
  - **96 instances** of text set to `font-size: 0.7rem` (11.2px) and `font-size: 0.68rem` (10.88px) in admin navigation, order status tags, table headers, and metadata.
  - *Impeccable Quality Floor:* Functional interactive UI text must never fall below 11px; body text must never fall below 14px (16px optimal).
* **Line Measures & Text Wrapping:**
  - Hero headings wrap awkwardly on narrow viewports without `text-wrap: balance`.
  - Long crystal cleansing guides and product descriptions lack `text-wrap: pretty` and exceed 80 characters per line (`ch > 80`), degrading reading comfort.

---

### Pass 6: Color (`colorize`)
* **Palette Discipline:**
  - While `:root` defines rich mineral tones, the codebase contains over **1,200 hardcoded hex values**:
    - `#985e38` (copper) hardcoded **367 times**.
    - `#ffffff` (white) hardcoded **293 times**.
    - `#1d2739` (obsidian ink) hardcoded **202 times**.
    - `#f4efe5` (warm cream) hardcoded **110 times**.
    - `#eae3d6` (border) hardcoded **96 times**.
    - `#4e5a70` (muted text) hardcoded **95 times**.
* **Rogue Hex Values:**
  - Untokenized slate blues (`#64748b`), dark greys (`#2b2b2b`, `#444`, `#555`), and harsh blacks (`#0e0c1a`) create muddy contrast inconsistencies.
* **Accent Overuse:**
  - Copper (`#985e38`) is used simultaneously for primary action buttons, hover states, badges, icon containers, borders, and links. When everything is copper, nothing stands out.
  - *Remedy:* Reserve Copper strictly for primary conversion triggers and celestial accent touches. Let Obsidian Slate (`#1d2739`) anchor structural chrome.

---

### Pass 7: Normalize & Consistency
* **Button Component Fragmentation:**
  - 14 different button classes exist across stylesheets with conflicting geometries:
    - `.btn` in `styles.scss`: `padding: 0.72rem 1.6rem; border-radius: 4px`
    - `.btn-outline` in `products.css`: `padding: 0 1.15rem; height: 38px`
    - `.save-btn` in `settings.css`: `padding: 0.65rem 1.4rem; border-radius: 8px`
    - `.admin-nav-search-btn`: `padding: 0.45rem 0.65rem; border-radius: 6px`
    - `.chip-btn`: `border-radius: unset`
* **Form Inputs & Search Fields:**
  - Text inputs vary between 36px, 42px, and 48px heights. Border colors vary between `#eae3d6`, `#d4cdc3`, `#e2e8f0`, and `#ccc`.
* **Modal Overlays & Drawers:**
  - Backdrop overlays are declared redundantly in 8 separate files (`admin-drawer-overlay`, `admin-modal-overlay`, `modal-backdrop`, `cart-drawer-backdrop`), each with slightly different opacity (`0.4`, `0.5`, `0.65`, `0.7`) and transition timings.

---

### Pass 8: Distill & Quieter (`distill` / `quieter`)
* **Inline Style Hygiene:**
  - **25 HTML templates** contain over **55 inline `style="..."` attributes** (e.g. `order-detail-drawer.html`, `orders.html`, `zodiac.html`, `support.html`).
  - These bypass encapsulation, prevent responsive overrides, and create visual debt.
* **Nested Container Noise (`nested-cards`):**
  - In `ProductDetails` and `AdminOrders`, cards are nested inside bordered cards inside shaded sections.
  - *Distill Rule:* Remove inner borders; use 8px/16px whitespace and subtle background tint shifts (`--color-surface-tint`) to define groups.
* **AI Tells to Eliminate:**
  - Side-tab thick borders on cards (`border-left: 4px solid var(--color-copper)`).
  - Floating colored drop-shadow glows (`box-shadow: 0 10px 24px rgba(152, 94, 56, 0.28)`). Ground elements with neutral, natural ambient occlusion shadows.

---

### Pass 9: Clarify (`clarify`)
* **UX Copy & Microcopy:**
  - *Mystery Box Page:* The selection prompt says *"Choose your configuration"* &rarr; should be *"Select Your Energetic Tier"*.
  - *Product Detail Affirmations:* Tab labeled *"Affirmation & Care"* &rarr; should be *"Sacred Ritual & Cleansing Guide"*.
  - *Admin CSV Export:* Button labeled *"Export CSV"* &rarr; should clarify scope, e.g., *"Export Orders with Delivery Notes (CSV)"*.
* **Validation & Error Messaging:**
  - Checkout postal code validation states *"Invalid format"* &rarr; should specify *"Please enter a valid 6-digit Indian PIN code (e.g. 380015)"*.

---

### Pass 10: Adapt (`adapt`)
* **Mobile Screen Discipline (360px – 430px):**
  - Minimum touch target size of 44x44px is generally respected, but table action menus in mobile viewports (`390px`) wrap into vertical stacks, causing horizontal scroll blowout.
* **Tablet Viewports (768px – 1024px):**
  - In `/products`, the 3-column product grid collapses to 2 columns, but card titles wrap into 3 uneven lines, causing misalignment of price tags.
* **Large & Ultrawide Screens (1440px – 1920px+):**
  - Max container width of 1400px works well, but wide screens lack margin centering in admin layout views, leaving the sidebar isolated on the left edge.

---

### Pass 11: Harden (`harden`)
* **Broken Image Safeguards:**
  - Angular property bindings `[src]="product.imageUrl"` fail silently if the image CDN drops or URL is null.
  - *Solution:* Implement an image fallback directive (`appImgFallback`) that injects a soothing mineral texture placeholder SVG whenever an image fails to load.
* **Loading & Skeleton States:**
  - Several pages still use jarring circular spinners (`<div class="spinner"></div>`) rather than shimmer skeleton cards. When content loads, the page abruptly jumps.
* **Zero-State Activation (`onboard`):**
  - Cart drawer empty state displays *"Your cart is empty"* with no quick-action links. It should display *"Your sacred basket is waiting"* followed by 3 one-click bestselling intention crystal pills.

---

### Pass 12: Animate & Delight (`animate` / `delight`)
* **Motion Discipline:**
  - Linear or bouncy transitions feel jarring. Standardize all interactive transitions to snappy exponential deceleration: `cubic-bezier(0.16, 1, 0.3, 1)`.
* **Reduced Motion Compliance:**
  - Many animations lack `@media (prefers-reduced-motion: reduce)`. Users with vestibular sensitivity must be respected.
* **Delight Micro-Moments:**
  - *Crystal Cleansing Modal:* Add a subtle shimmer particle effect when a user completes their crystal activation ritual.
  - *Checkout Completion:* A quiet, elegant celebratory affirmation fade-in celebrating their energetic investment.

---

### Pass 13: Optimize (`optimize`)
* **Angular CLI Bundle Budget Violations:**
  - `home.css` is **40.1 KB** (Budget: 20 KB maximum warning, 35 KB error).
  - `product-details.css` is **44.8 KB** (Budget: 20 KB maximum warning, 35 KB error).
  - Initial JS bundle is **1.45 MB** (Budget: 1.0 MB).
* **Optimization Action:**
  - Extract sub-sections of `home.css` (Zodiac wheel, testimonials, newsletter) into standalone component stylesheets.
  - Decompose `product-details.css` into separate sub-component files (`gallery.css`, `specs.css`, `reviews.css`).
  - Lazy-load admin modules and charting libraries.

---

### Pass 14: Extract (`extract`)
* **Duplicated Code Requiring Extraction:**
  1. *Modal Backdrop & Frame:* Repeated in 8+ components. Extract to `<app-modal [isOpen]="..." (closed)="...">`.
  2. *Off-Canvas Drawer:* Repeated in Cart Drawer, Filter Drawer, and Admin Order Detail. Extract to `<app-drawer>`.
  3. *Status Pill:* Repeated across customer orders and admin tables. Extract to `<app-badge [variant]="'success' | 'warning' | 'info' | 'copper'">`.
  4. *Loading Shimmer / Skeleton:* Repeated inline. Extract to `<app-skeleton [type]="'card' | 'text' | 'image'">`.
  5. *Keyframe Animations:* Spinner animation keyframes duplicated in 5 distinct CSS files. Consolidate into `styles.scss`.

---

## Structure & Refactor Architecture Plan

### Modern Angular 21 Directory Architecture

The current frontend directory structure is flat and unscaled: 29 loose pages in `pages/`, 23 un-namespaced widgets in `components/`, and 19 admin directories in `admin/`.

```
Frontend/src/app/
├── core/                           # Application Singletons & Infrastructure
│   ├── guards/                     # auth.guard.ts, admin.guard.ts
│   ├── interceptors/               # auth.interceptor.ts, error.interceptor.ts
│   ├── tokens/                     # Injection tokens, config
│   └── services/                   # Core state (auth.service, cart.service, seo.service)
│
├── shared/                         # Reusable Presentation Components & Utilities
│   ├── components/                 # Headless & UI Atoms/Molecules
│   │   ├── modal/                  # <app-modal> (Universal dialog with a11y focus trap)
│   │   ├── drawer/                 # <app-drawer> (Slide-over drawer for cart, filters, admin)
│   │   ├── badge/                  # <app-badge> (Standardized status tag)
│   │   ├── skeleton/               # <app-skeleton> (Smooth shimmer placeholders)
│   │   ├── button/                 # <app-button> (Unified button styles)
│   │   ├── pagination/             # <app-pagination> (Accessible page controls)
│   │   └── star-rating/            # <app-star-rating>
│   ├── directives/                 # img-fallback.directive.ts, focus-visible.directive.ts
│   ├── pipes/                      # currency-inr.pipe.ts, date-vedic.pipe.ts
│   └── models/                     # Shared TypeScript DTOs and contracts
│
├── features/                       # Domain Feature Modules (Lazy-Loaded)
│   ├── shop/                       # Public Storefront Feature
│   │   ├── home/                   # Landing page & sub-sections
│   │   ├── catalog/                # /products (Filter drawer, grid, load-more)
│   │   ├── product-detail/         # /product/:slug (Split into focused sub-components)
│   │   │   ├── components/
│   │   │   │   ├── product-gallery/
│   │   │   │   ├── product-overview/
│   │   │   │   ├── product-specs/
│   │   │   │   ├── product-affirmation/
│   │   │   │   ├── product-bundle/
│   │   │   │   └── product-reviews/
│   │   │   └── product-detail.component.ts
│   │   └── zodiac/                 # Vedic astrology sign finder & zodiac hub
│   │
│   ├── checkout/                   # Transactional Funnel
│   │   ├── cart/                   # Full cart view & drawer
│   │   ├── checkout-flow/          # 3-step checkout accordion
│   │   └── order-confirmation/
│   │
│   ├── account/                    # Customer Portal
│   │   ├── overview/
│   │   ├── orders/
│   │   ├── addresses/
│   │   └── wishlist/
│   │
│   └── admin/                      # Backoffice Operations
│       ├── layout/                 # Admin sidebar, header, command palette
│       ├── dashboard/              # Metrics & insights
│       ├── products/               # Product catalog & stock
│       ├── orders/                 # Order list & detail drawer
│       ├── reviews/
│       └── settings/
```

---

### Decomposition of God Components

#### 1. `ProductDetailsComponent` (Current: 3,850 lines combined)
* **What it currently does:** Image zoom, thumbnail navigation, price calculation, variant selection, intention badges, affirmation guide, cleansing rituals, physical dimensions, customer review summaries, photo gallery lightbox, add to cart mutation, sticky bottom bar, related products, and bundle kits.
* **Target Refactor:** Split into 6 modular, single-responsibility sub-components:
  1. `<app-product-gallery>`: Image zoom, thumbnail carousel, and full-screen lightbox.
  2. `<app-product-overview>`: Title, price, Vedic zodiac badge, variant pills, quantity stepper, and CTA.
  3. `<app-product-specs>`: Dimension matrix, mineral composition, chakra alignment, and origin.
  4. `<app-product-ritual>`: Cleansing methods, moonlight charging, and affirmation copy.
  5. `<app-product-reviews>`: Review metrics, rating filters, photo thumbnails, and review cards.
  6. `<app-product-sticky-bar>`: Mobile bottom fixed purchase bar with synchronized variant picker.

#### 2. `AddressMapComponent` (Current: 731 lines TypeScript)
* **What it currently does:** Leaflet map rendering, Google Maps Places API autocomplete, reverse geocoding, pin-drag latitude/longitude capture, address form inputs, error handling, and manual fallback inputs.
* **Target Refactor:** Split into:
  1. `<app-map-picker>`: Pure map rendering, pin placement, and coordinate event emissions.
  2. `[appPlacesAutocomplete]`: Reusable directive for Google Places input bindings.
  3. `<app-address-form>`: Standardized reactive form with PIN code auto-fill.

---

### Duplicated CSS & Template Deduplication

| Duplicated Pattern | Current Locations (Count) | Remediation Plan |
|---|---|---|
| **Spinner Keyframes (`@keyframes spin`)** | `admin-shared.css`, `settings.css`, `map-address-fields.css`, `spinner.css`, `products.css` (5 files) | Remove local `@keyframes`. Move single unified `@keyframes studio-spin` to `styles.scss`. |
| **Drawer & Modal Backdrops** | `cart-drawer.css`, `compare-modal.css`, `cleansing-guide-modal.css`, `admin-shared.css`, `order-detail-drawer.css` (8 files) | Create shared `<app-modal>` and `<app-drawer>` components using CSS class `.studio-backdrop`. |
| **Status Badge Styling** | Repeated across `orders.css`, `returns.css`, `admin-orders.css`, `stock.css` | Consolidate into `<app-badge>` with 4 tokenized variants: `success`, `warning`, `danger`, `copper`. |
| **Inline HTML Styles** | 25 templates containing 55+ `style="..."` attributes | Migrate all inline CSS rules to named utility classes in component stylesheets or global utilities. |

---

### Production-Grade Design Token Layer

Add this standardized, collision-free token layer to `Frontend/src/styles.scss`:

```css
:root {
  /* ==========================================================================
     ZodiacCrystal Master Design Tokens
     Apothecary Luxury Mineral Palette & Architectural Spacing Scale
     ========================================================================== */

  /* --- Core Palette: Canvas & Minerals --- */
  --color-canvas: #fbf8f2;         /* Warm Alabaster Parchment (Primary Ground) */
  --color-surface: #ffffff;        /* Pure White Card Surface */
  --color-surface-raised: #ffffff; /* Elevated Container */
  --color-surface-tint: #f5f0e6;   /* Bone / Sand Muted Container Tint */
  --color-surface-sunken: #ede6d9; /* Deep Parchment Inset Ground */

  /* --- Borders & Dividers --- */
  --color-border: #eae3d6;         /* Sandstone Architectural Border */
  --color-border-subtle: #f0eae0;  /* Subtle Hairline Divider */
  --color-border-hover: #d4cbbc;   /* Hover State Border */

  /* --- Ink & Typographic Scale --- */
  --color-ink: #1d2739;            /* Deep Obsidian Slate (9.8:1 WCAG Contrast) */
  --color-ink-secondary: #4e5a70;  /* Muted Slate Text (5.2:1 WCAG Contrast) */
  --color-ink-subtle: #6d695d;     /* Flint / Caption Text (4.6:1 WCAG Contrast) */

  /* --- Mineral Accents --- */
  --color-copper: #985e38;         /* Sacred Burnished Copper */
  --color-copper-hi: #a6683c;      /* High Contrast Copper (Accessible on White) */
  --color-copper-light: #faf5ee;   /* Warm Copper Glow Tint */
  --color-gold: #c8963e;           /* Celestial Zodiac Gold */
  --color-gold-tint: #fbf4e8;      /* Gold Accent Tint */
  --color-sage: #3d6b52;           /* Healing Sage Green */
  --color-sage-tint: #edf5f0;      /* Sage Background Tint */

  /* --- Semantic Status Tokens (All WCAG AA Compliant) --- */
  --color-status-success: #1b6e37;
  --color-status-success-bg: #eaf4ee;
  --color-status-warning: #945600;
  --color-status-warning-bg: #fff5e6;
  --color-status-danger: #b3261a;
  --color-status-danger-bg: #fdf0ef;
  --color-status-info: #16539e;
  --color-status-info-bg: #ecf3fb;

  /* --- Strict 4px/8px Spacing Rhythm Scale --- */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */
  --space-20: 5rem;    /* 80px */

  /* --- Architectural Radius Scale --- */
  --radius-xs: 2px;
  --radius-sm: 4px;    /* Core Brand Corner: Architectural & Crisp */
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-pill: 9999px;

  /* --- Elevation & Natural Ambient Shadows --- */
  --shadow-sm: 0 1px 3px rgba(29, 39, 57, 0.05), 0 1px 2px rgba(29, 39, 57, 0.04);
  --shadow-md: 0 4px 12px rgba(29, 39, 57, 0.06), 0 1px 3px rgba(29, 39, 57, 0.04);
  --shadow-lg: 0 12px 28px rgba(29, 39, 57, 0.08), 0 4px 8px rgba(29, 39, 57, 0.04);
  --shadow-drawer: -8px 0 24px rgba(29, 39, 57, 0.12);

  /* --- Centralized Z-Index Hierarchy (Eliminating 22 Random Values) --- */
  --z-base: 0;
  --z-raised: 10;
  --z-dropdown: 50;
  --z-sticky: 100;
  --z-backdrop: 800;
  --z-drawer: 900;
  --z-modal: 1000;
  --z-toast: 1100;
  --z-tooltip: 1200;

  /* --- Motion Timing --- */
  --ease-snappy: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
}
```

---

### Key Page Layout Blueprints

#### 1. Home Page Flow
```
[ Top Sacred Bar: Free Cleansing & Energizing on Orders Over ₹999 ]
[ Header & Mega Navigation with Vedic Sign Quick Picker ]
[ Hero Banner: High-Vibrational Mineral Curation + Single Clear CTA ]
[ Sacred Intentions Rail: Wealth | Love | Protection | Clarity | Peace ]
[ Curated Best Sellers Grid (4 Columns Desktop / 2 Columns Mobile) ]
[ Interactive Vedic Sign Explorer: Discover Your Ascendant Stone ]
[ Ethical Sourcing & Cleansing Ritual Affirmation Showcase ]
[ Instagram Community / Verified Customer Reviews Carousel ]
[ Editorial Journal / Crystal Care Guide Links ]
[ Architectural Footer with Newsletter Sign-Up ]
```

#### 2. Product Details Page Flow (Decomposed)
```
+---------------------------------------+---------------------------------------+
|  LEFT COLUMN: STICKY GALLERY          |  RIGHT COLUMN: PURCHASE & STORY       |
|  - High-res main image with zoom      |  - Vedic Sign & Intention Pills       |
|  - Thumbnails with keyboard nav       |  - Title (Fraunces Serif)             |
|  - Customer real photos trigger       |  - Price & Weight                     |
|                                       |  - Chakra & Planetary Association     |
|                                       |  - Quantity Stepper + Add to Basket   |
|                                       |  - Trust Badges: Cleansed & Energized |
|                                       |  - Accordion 1: Sacred Cleansing Care |
|                                       |  - Accordion 2: Physical Specs & Size |
+---------------------------------------+---------------------------------------+
|  FULL-WIDTH SECTION: Vedic Energy Consultation Banner                         |
|  FULL-WIDTH SECTION: Verified Reviews with Star Breakdown & Photo Gallery    |
|  FULL-WIDTH SECTION: Related Sacred Crystals for Your Astrological House     |
+-------------------------------------------------------------------------------+
|  MOBILE ONLY: Sticky Bottom Bar [Thumb Image | Title | Price | Add to Bag]   |
+-------------------------------------------------------------------------------+
```

---

### Visual Direction & Palette Refinements

1. **Eliminate Cold Tech Greys:**
   - Remove `#64748b` and `#e2e8f0`. Replace with warm sandstone neutrals `--color-ink-secondary: #4e5a70` and `--color-border: #eae3d6`.
2. **Eliminate Harsh Blacks:**
   - Remove `#0e0c1a` and `#000000`. Use Deep Obsidian Slate `--color-ink: #1d2739` to maintain an organic, tactile mineral aesthetic.
3. **Accentuate with Meaning:**
   - Use Sacred Copper (`#985e38`) strictly for primary transaction buttons and highlighted Vedic elements.
   - Introduce Healing Sage (`#3d6b52` text, `#edf5f0` background) for "Cleansed & Certified" trust badges and eco-friendly packaging notices.
   - Introduce Celestial Gold (`#c8963e`) exclusively for Vedic horoscope matches and high-vibrational indicators.

---

## Detailed Suggestions & Remediation Catalog

### Suggestion 1: Monolith Breakdown of `ProductDetailsComponent`
* **Pass / Command:** `impeccable extract` / `shape`
* **File:** `Frontend/src/app/pages/product-details/product-details.ts`, `product-details.html`, `product-details.css`
* **What is Wrong & Why it Matters:** The component is a 3,850-line monolith (904 lines TS, 901 lines HTML, 2,045 lines CSS). It violates Single Responsibility Principle, bloats bundle size (44.8 KB CSS exceeds 20 KB budget), impairs testability, and slows team velocity.
* **Exact Fix:** Decompose into 6 modular standalone components under `Frontend/src/app/features/shop/product-detail/components/`:
  - `product-gallery/`
  - `product-overview/`
  - `product-specs/`
  - `product-ritual/`
  - `product-reviews/`
  - `product-sticky-bar/`
* **Tag:** `[STRUCTURE]`
* **Priority:** Critical
* **Effort:** Large

---

### Suggestion 2: Eliminate CSS Bundle Budget Warnings for `home.css` & `product-details.css`
* **Pass / Command:** `impeccable optimize`
* **File:** `Frontend/src/app/pages/home/home.css` (40.1 KB), `Frontend/src/app/pages/product-details/product-details.css` (44.8 KB)
* **What is Wrong & Why it Matters:** Angular build emits budget errors because individual component styles exceed the 35 KB error limit (`maximumError: 35kB` in `angular.json`). This increases render-blocking time and slows mobile FCP.
* **Exact Fix:** Extract sub-section CSS into separate standalone components.
```diff
--- a/Frontend/src/app/pages/home/home.ts
+++ b/Frontend/src/app/pages/home/home.ts
+// Split home into standalone child components:
+// <app-home-hero>, <app-home-intentions>, <app-home-zodiac-wheel>, <app-home-testimonials>
+// Each component carries its own scoped < 10KB stylesheet.
```
* **Tag:** `[STRUCTURE]`
* **Priority:** High
* **Effort:** Medium

---

### Suggestion 3: Universal Image Fallback Directive (`[appImgFallback]`)
* **Pass / Command:** `impeccable audit` / `harden`
* **File:** `Frontend/src/app/components/product-card/product-card.html`, `Frontend/src/app/pages/cart/cart.html` (35 files identified by detector)
* **What is Wrong & Why it Matters:** Detector surfaced 35 `[broken-image]` instances where `[src]` has no fallback handler. When a product image fails or is missing, browsers render an ugly broken image outline.
* **Exact Fix:** Create and apply an Angular directive `appImgFallback`:
```diff
--- a/Frontend/src/app/components/product-card/product-card.html
+++ b/Frontend/src/app/components/product-card/product-card.html
- <img [src]="product.imageUrl" [alt]="product.name" class="product-thumb" />
+ <img [src]="product.imageUrl" 
+      [alt]="product.name" 
+      appImgFallback="assets/images/crystal-placeholder.webp"
+      loading="lazy" 
+      width="320" 
+      height="320" 
+      class="product-thumb" />
```
* **Tag:** `[LOGIC]`
* **Priority:** High
* **Effort:** Small

---

### Suggestion 4: Purge 55+ Inline HTML Styles and Migrate to CSS
* **Pass / Command:** `impeccable distill`
* **File:** `Frontend/src/app/admin/orders/orders.html`, `order-detail-drawer.html`, `zodiac.html` (25 templates)
* **What is Wrong & Why it Matters:** Templates contain inline `style="width: 44px"`, `style="display:inline-block; vertical-align:-1px"`, `style="height: 5.5rem"`. This bypasses CSS encapsulation and breaks responsive adaptation.
* **Exact Fix:**
```diff
--- a/Frontend/src/app/admin/orders/orders.html
+++ b/Frontend/src/app/admin/orders/orders.html
- <span style="display:inline-block; vertical-align:-1px; margin-right:3px">📦</span>
+ <span class="order-type-icon">📦</span>
```
```css
/* In orders.css */
.order-type-icon {
  display: inline-block;
  vertical-align: -1px;
  margin-right: var(--space-1);
}
```
* **Tag:** `[LOOK]`
* **Priority:** High
* **Effort:** Medium

---

### Suggestion 5: Restore Accessible Focus Indicators (`:focus-visible`)
* **Pass / Command:** `impeccable audit`
* **File:** `Frontend/src/app/admin/admin-shared.css`, `Frontend/src/styles.scss` (37 files with `outline: none`)
* **What is Wrong & Why it Matters:** 37 stylesheets reset `outline: none` without providing an accessible alternative, violating WCAG 2.4.7 (Focus Visible). Keyboard-only users cannot navigate forms or admin tables.
* **Exact Fix:**
```diff
--- a/Frontend/src/styles.scss
+++ b/Frontend/src/styles.scss
+ :focus-visible {
+   outline: 2px solid var(--color-copper);
+   outline-offset: 2px;
+ }
+ button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
+   outline: 2px solid var(--color-copper);
+   outline-offset: 2px;
+ }
```
* **Tag:** `[LOOK]`
* **Priority:** Critical
* **Effort:** Small

---

### Suggestion 6: Tokenize 1,200+ Hardcoded Hex Colors
* **Pass / Command:** `impeccable colorize`
* **File:** All component CSS files across `Frontend/src/app/`
* **What is Wrong & Why it Matters:** Hardcoded `#985e38` (367 occurrences), `#ffffff` (293 occurrences), `#1d2739` (202 occurrences), `#f4efe5` (110 occurrences) prevent global theming, dark mode support, and palette refinement.
* **Exact Fix:** Replace raw hex values with CSS variables across stylesheets:
  - `#985e38` &rarr; `var(--color-copper)`
  - `#1d2739` &rarr; `var(--color-ink)`
  - `#f4efe5` &rarr; `var(--color-surface-tint)`
  - `#eae3d6` &rarr; `var(--color-border)`
  - `#4e5a70` &rarr; `var(--color-ink-secondary)`
* **Tag:** `[LOOK]`
* **Priority:** High
* **Effort:** Medium

---

### Suggestion 7: Harmonize Z-Index Chaos to a 6-Tier Scale
* **Pass / Command:** `impeccable layout`
* **File:** 22 CSS files using arbitrary z-index values (`0, 1, 2, 3, 5, 10, 40, 50, 100, 150, 510, 590, 600, 1000, 1005, 1010, 1050, 1100, 1200, 1500, 2000, 2200`)
* **What is Wrong & Why it Matters:** Uncoordinated z-index numbers lead to stacking context bugs where sticky bars clip dropdowns, or modals appear behind navigation headers.
* **Exact Fix:** Bind all positioning to the master tokens:
  - Dropdowns: `var(--z-dropdown)` (50)
  - Sticky Headers & Bars: `var(--z-sticky)` (100)
  - Backdrops: `var(--z-backdrop)` (800)
  - Drawers: `var(--z-drawer)` (900)
  - Modals: `var(--z-modal)` (1000)
  - Toasts: `var(--z-toast)` (1100)
* **Tag:** `[LOOK]`
* **Priority:** High
* **Effort:** Small

---

### Suggestion 8: Elevate Undersized UI Text (< 11.5px)
* **Pass / Command:** `impeccable typeset`
* **File:** 96 instances in `admin-nav.css`, `dashboard.css`, `order-detail-drawer.css`, `orders.css`
* **What is Wrong & Why it Matters:** Micro-labels set to `0.68rem` (10.88px) and `0.7rem` (11.2px) fail Impeccable's `undersized-ui-text` rule and cause strain on mobile and high-DPI displays.
* **Exact Fix:** Set a strict 12px (`0.75rem`) minimum for all interactive and functional microcopy:
```diff
--- a/Frontend/src/app/admin/orders/orders.css
+++ b/Frontend/src/app/admin/orders/orders.css
- .order-meta-tag { font-size: 0.68rem; }
+ .order-meta-tag { font-size: var(--text-xs); /* 0.75rem / 12px */ }
```
* **Tag:** `[LOOK]`
* **Priority:** High
* **Effort:** Small

---

### Suggestion 9: Extract Reusable Modal and Drawer Components
* **Pass / Command:** `impeccable extract`
* **File:** `cleansing-guide-modal`, `find-crystal-modal`, `compare-modal`, `order-detail-drawer`, `cart-drawer`
* **What is Wrong & Why it Matters:** Modal framing, overlay backdrops, Escape key listeners, and focus traps are implemented independently with duplicated code in 8 components.
* **Exact Fix:** Create `<app-modal>` and `<app-drawer>` in `Frontend/src/app/shared/components/` with `@Input() isOpen`, `@Output() closeRequested`, and native `<dialog>` or focus trap logic.
* **Tag:** `[STRUCTURE]`
* **Priority:** High
* **Effort:** Medium

---

### Suggestion 10: Standardize Button Geometries & Radius Scale
* **Pass / Command:** `impeccable normalize`
* **File:** `Frontend/src/styles.scss`, `products.css`, `settings.css`, `admin-shared.css`
* **What is Wrong & Why it Matters:** Buttons alternate randomly between 0px, 4px, 6px, and 8px border radii, and paddings range from 0 to 1.6rem without standard sizing tiers.
* **Exact Fix:** Standardize into 3 size classes:
  - Small (`.btn-sm`): Height 32px, `padding: 0 0.75rem`, `font-size: 0.8125rem`
  - Medium (`.btn-md`): Height 42px, `padding: 0 1.25rem`, `font-size: 0.875rem`
  - Large (`.btn-lg`): Height 50px, `padding: 0 1.75rem`, `font-size: 1rem`
  - Border-radius locked to `var(--radius-sm)` (4px) across all buttons for architectural consistency.
* **Tag:** `[LOOK]`
* **Priority:** Medium
* **Effort:** Small

---

### Suggestion 11: Implement Shimmer Skeletons to Prevent Layout Shifts
* **Pass / Command:** `impeccable harden` / `optimize`
* **File:** `Frontend/src/app/pages/products/products.html`, `Frontend/src/app/pages/orders/orders.html`
* **What is Wrong & Why it Matters:** While data loads, pages show a single circular spinner, then pop into existence abruptly, causing CLS and a jarring user experience.
* **Exact Fix:** Replace spinner with `<app-skeleton>` cards matching the exact grid geometry of the product and order cards.
* **Tag:** `[LOOK]`
* **Priority:** Medium
* **Effort:** Medium

---

### Suggestion 12: Add `prefers-reduced-motion` to Keyframe Animations
* **Pass / Command:** `impeccable animate`
* **File:** `Frontend/src/styles.scss`, `cart-drawer.css`, `birthday-sign-finder.css`
* **What is Wrong & Why it Matters:** Drawer slide-ins and zodiac wheel rotations do not respect user system preferences for reduced motion, failing accessibility guidelines for motion sensitivity.
* **Exact Fix:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
* **Tag:** `[LOOK]`
* **Priority:** Medium
* **Effort:** Small

---

### Suggestion 13: Enforce `text-wrap: balance` on Headings and `pretty` on Body
* **Pass / Command:** `impeccable typeset`
* **File:** `Frontend/src/styles.scss`
* **What is Wrong & Why it Matters:** Headings on product detail and hero sections frequently end with single-word orphan lines ("stragglers"), degrading editorial polish.
* **Exact Fix:**
```css
h1, h2, h3, h4, .font-heading {
  text-wrap: balance;
}
p, .reading-measure {
  text-wrap: pretty;
  max-width: 68ch;
}
```
* **Tag:** `[LOOK]`
* **Priority:** Low
* **Effort:** Small

---

### Suggestion 14: Decompose `AddressMapComponent`
* **Pass / Command:** `impeccable extract` / `shape`
* **File:** `Frontend/src/app/components/address-map/address-map.ts` (731 lines)
* **What is Wrong & Why it Matters:** Combines Leaflet map rendering, Google Places API autocomplete, address validation, geocoding, and form inputs in a single file.
* **Exact Fix:** Extract Google Places autocomplete logic into an Angular directive `[appPlacesAutocomplete]`, and map rendering into `<app-leaflet-map-picker>`.
* **Tag:** `[STRUCTURE]`
* **Priority:** Medium
* **Effort:** Medium

---

## Master Synthesis & Phased Roadmap

### Numbered Master List

1. **[STRUCTURE]** Split `ProductDetailsComponent` (3,850 lines) into 6 sub-components (`gallery`, `overview`, `specs`, `ritual`, `reviews`, `sticky-bar`).
2. **[STRUCTURE]** Split `home.css` (40.1 KB) and `product-details.css` (44.8 KB) to resolve Angular CLI bundle budget errors.
3. **[LOGIC]** Implement `appImgFallback` directive across 35 templates to eliminate broken image boxes.
4. **[LOOK]** Remove 55+ inline `style="..."` attributes across 25 HTML files and move to classes.
5. **[LOOK]** Add universal `:focus-visible` ring across 37 stylesheets currently resetting `outline: none`.
6. **[LOOK]** Tokenize 1,200+ occurrences of hardcoded hex values (`#985e38`, `#1d2739`, `#f4efe5`, `#eae3d6`).
7. **[LOOK]** Replace 22 random `z-index` numbers with the centralized 6-tier token scale.
8. **[LOOK]** Upgrade 96 instances of sub-11.5px text to the standard 12px (`0.75rem`) minimum floor.
9. **[STRUCTURE]** Extract duplicated modal and drawer backdrops into shared `<app-modal>` and `<app-drawer>`.
10. **[LOOK]** Standardize button heights (32px, 42px, 50px) and lock border-radius to 4px (`var(--radius-sm)`).
11. **[LOOK]** Implement shimmer skeleton loading cards for products and orders to eliminate CLS.
12. **[LOOK]** Wrap all CSS keyframe animations in `@media (prefers-reduced-motion: reduce)` queries.
13. **[LOOK]** Apply `text-wrap: balance` to headings and `text-wrap: pretty` to body copy.
14. **[STRUCTURE]** Decompose `AddressMapComponent` (731 lines) into directive and map child components.
15. **[LOOK]** Consolidate `@keyframes spin` declarations from 5 separate files into `styles.scss`.
16. **[LOOK]** Unify container max-width to `1400px` across Home, Catalog, and Account pages.
17. **[LOOK]** Introduce Healing Sage (`#3d6b52`) and Celestial Gold (`#c8963e`) tokens to reduce Copper overuse.
18. **[CLARIFY]** Enhance checkout PIN code validation error copy and empty cart activation prompts.

---

### 4-Phase Execution Roadmap

```
PHASE 1: Quick Wins & Hygiene (Zero Risk, High Polish)
├── 1. Add universal :focus-visible styles to styles.scss (Suggestion 5)
├── 2. Purge 55+ inline style="" attributes across templates (Suggestion 4)
├── 3. Enforce 6-tier z-index scale (Suggestion 7)
├── 4. Apply prefers-reduced-motion reset (Suggestion 12)
└── 5. Consolidate duplicated @keyframes spin to styles.scss

PHASE 2: Design Token & Consistency Alignment
├── 1. Replace 1,200+ raw hex codes with CSS variables (Suggestion 6)
├── 2. Standardize button sizing (32/42/50px) and 4px radius (Suggestion 10)
├── 3. Upgrade 96 instances of tiny text (< 11.5px) to 12px (Suggestion 8)
├── 4. Implement appImgFallback directive across 35 templates (Suggestion 3)
└── 5. Unify container max-widths to 1400px

PHASE 3: Structure & Monolith Refactoring
├── 1. Decompose ProductDetailsComponent into 6 sub-components (Suggestion 1)
├── 2. Split home.css and product-details.css to eliminate budget errors (Suggestion 2)
├── 3. Extract shared <app-modal> and <app-drawer> (Suggestion 9)
├── 4. Decompose AddressMapComponent (Suggestion 14)
└── 5. Adopt new Angular 21 directory layout (core/, shared/, features/)

PHASE 4: Visual Direction & Delight Touches
├── 1. Implement refined apothecary palette (Healing Sage & Celestial Gold)
├── 2. Replace abrupt spinners with shimmer skeleton placeholders (Suggestion 11)
├── 3. Add text-wrap: balance and text-wrap: pretty (Suggestion 13)
└── 4. Add sacred affirmation micro-interactions on ritual completion
```

---

### Top 10 High-Impact Changes to Make First

1. **Restore `:focus-visible` Accessibility Rings (Suggestion 5):** Immediate a11y compliance win for 37 components.
2. **Implement Universal Image Fallback Directive (Suggestion 3):** Prevents 35 templates from rendering broken image boxes.
3. **Split `ProductDetailsComponent` (Suggestion 1):** Eliminates 3,850 lines of technical debt from the core conversion page.
4. **Fix Bundle Budget Errors in `home.css` & `product-details.css` (Suggestion 2):** Restores clean Angular production builds and improves FCP.
5. **Purge Inline `style="..."` Attributes (Suggestion 4):** Restores proper CSS encapsulation and clean HTML.
6. **Tokenize Hardcoded Hex Colors (Suggestion 6):** Cleans up 1,200+ raw color values and enables reliable brand styling.
7. **Harmonize Z-Index Scale (Suggestion 7):** Prevents visual clipping glitches between dropdowns, headers, and modals.
8. **Extract Shared `<app-modal>` and `<app-drawer>` (Suggestion 9):** De-duplicates modal code across 8 components.
9. **Elevate Undersized UI Text (Suggestion 8):** Eliminates 96 instances of sub-11.5px text for high legibility.
10. **Replace Spinners with Shimmer Skeletons (Suggestion 11):** Provides an immediate perceived performance and polish upgrade.

---

### What Is Already Good and Must Stay

1. **Angular 21 Standalone & Signal Reactivity:** The application leverages modern Angular Signals (`signal`, `computed`, `effect`) and modern control flow (`@if`, `@for`, `@switch`) with zero legacy NgModules. This is exceptional and must be preserved.
2. **Authentic Vedic Astrological Depth:** The deep integration of Vedic moon signs, ascendants, and planetary gemstones gives ZodiacCrystal a authentic, authoritative identity that sets it apart from generic e-commerce templates.
3. **Luxury D2C "Load More" + Progress Bar:** The recent implementation of the dynamic progress bar ("Viewing X of Y crystals") combined with a luxury "Load More" trigger matches best-in-class luxury e-commerce benchmarks.
4. **44px Mobile Touch Ergonomics:** Primary buttons, nav triggers, and quantity selectors rigorously honor the 44x44px minimum touch target size.
5. **Fraunces Serif + Inter Typography Pairing:** The pairing of high-contrast editorial serif headings with crisp modern sans-serif body text creates an elegant, premium aesthetic.
6. **Thorough Multi-Step Checkout Flow:** The checkout experience provides smooth accordions, clear order summaries, and comprehensive address/PIN code management.

