# Zodiac Crystals Design System

> **Brand Philosophy:** Warm mineral neutrals, authentic stone surfaces, deep malachite forest accents, muted brass highlights, refined serif headings, and accessible high-contrast typography (WCAG AA). Designed for a premium, independent crystal and spiritual jewelry storefront.

---

## 1. Color Palette & Semantic Tokens

### Canvas & Neutral Surfaces
| Token | Value | Swatch Preview / Usage |
|---|---|---|
| `--color-canvas` | `#f7f4ee` | Warm stone/sand page background canvas |
| `--color-surface` | `#ffffff` | Pure white card and panel surfaces |
| `--color-surface-raised` | `#fbf9f5` | Elevated card fill, dropdown item active state |
| `--color-surface-tint` | `#f2eee6` | Bone neutral tint, input disabled, table alt rows |
| `--color-surface-bone` | `#ece6da` | Tactile border track, skeleton track |
| `--color-border` | `#ded7c8` | Standard element border |
| `--color-border-subtle` | `#eae4d8` | Subtle interior divider / separator line |
| `--color-border-hover` | `#c9c1b0` | Interactive border hover state |

### Text & Ink Scale
| Token | Value | Contrast vs #f7f4ee | Usage |
|---|---|---|---|
| `--color-ink` | `#1c1a17` | **14.2 : 1** (AAA) | Primary headings, product titles, prices, body |
| `--color-muted` | `#524c43` | **6.1 : 1** (AA) | Labels, descriptions, secondary text |
| `--color-subtle` | `#6e675b` | **4.6 : 1** (AA) | Metadata, breadcrumbs, placeholder text |

### Mineral Accents
| Token | Value | Usage |
|---|---|---|
| `--color-brand` | `#244132` | Deep Malachite Forest Green – Primary brand action & filled buttons |
| `--color-brand-hover` | `#1c3427` | Deep Malachite hover state |
| `--color-brand-light` | `#eaf1ed` | Soft malachite tint for subtle chips, active tabs, modal icons |
| `--color-accent-gold` / `--color-brass` | `#ab7a24` | Muted Antique Brass – Promotional accents, star ratings, highlights |
| `--color-amethyst` | `#4a3656` | Royal Amethyst – Zodiac badges, seasonal callouts |
| `--color-slate` | `#3b464f` | Mineral Slate – Secondary badges, technical specs |

### Semantic Status Colors
All status combinations pair a tinted background with a dark, accessible ink color and a matching border:
| State | Text / Icon (`--color-*`) | Background (`--color-*-bg`) | Border (`--color-*-border`) |
|---|---|---|---|
| **Success** / In Stock / Delivered | `#1b6e37` | `#eaf4ee` | `#a6d8b5` |
| **Warning** / Low Stock / Pending | `#945600` | `#fff5e6` | `#f2caa0` |
| **Danger** / Out of Stock / Cancelled | `#b3261a` | `#fdf0ef` | `#f0b5af` |
| **Info** / Confirmed | `#16539e` | `#ecf3fb` | `#a9c8eb` |
| **Shipped** (Rust Mineral) | `#783c23` | `#faeee8` | `#e3b9aa` |

---

## 2. Typography

### Font Families
- **Headings & Brand:** `"Fraunces", Georgia, "Times New Roman", serif`
  - Used for `h1`, `h2`, `h3`, `.navbar-brand`, `.brand-logo`.
  - Gives the storefront an authentic, boutique apothecary and mineral aesthetic.
- **Body & Admin:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  - High legibility, crisp rendering across all operating systems.
- **Monospace:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`
  - Used for order numbers, tracking IDs, postal codes, and coupons.

### Type Scale
| Token | Size | Line Height | Typical Application |
|---|---|---|---|
| `--text-xs` | `0.75rem` (12px) | 1.15 | Badges, micro-labels, captions |
| `--text-sm` | `0.875rem` (14px) | 1.3 | Form labels, helper text, breadcrumbs, table cells |
| `--text-base` | `1rem` (16px) | 1.55 | Body paragraphs, input values, button text |
| `--text-md` | `1.125rem` (18px) | 1.4 | Product card titles, lead text |
| `--text-lg` | `1.25rem` (20px) | 1.3 | Section subheadings, modal titles |
| `--text-xl` | `1.5rem` (24px) | 1.25 | Card group headings, mobile page titles |
| `--text-2xl` | `1.875rem` (30px) | 1.2 | Section headings (`h2`) |
| `--text-3xl` | `2.25rem` (36px) | 1.15 | Storefront page titles (`h1`) |
| `--text-4xl` | `3rem` (48px) | 1.1 | Hero banner titles |

---

## 3. Elevation & Tactile Surfaces

Rather than generic dark blurred shadows, elevation in Zodiac Crystals uses fine stone borders paired with soft mineral ambient shadows:

| Token | CSS Definition | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(28, 26, 23, 0.05)` | Small buttons, chips, inline badges |
| `--shadow-card` | `0 1px 3px rgba(28, 26, 23, 0.05), 0 0 0 1px var(--color-border-subtle)` | Product cards, cart panels, tables |
| `--shadow-card-hover` | `0 8px 20px -3px rgba(28, 26, 23, 0.08), 0 0 0 1px var(--color-border)` | Card hover elevation |
| `--shadow-dropdown` | `0 10px 24px -4px rgba(28, 26, 23, 0.12), 0 0 0 1px var(--color-border)` | Search autosuggest, user menus |
| `--shadow-modal` | `0 20px 40px -8px rgba(28, 26, 23, 0.2), 0 0 0 1px var(--color-border)` | Confirm dialogs, slideover drawers, toasts |

---

## 4. Spacing & Border Radius

### Spacing Scale
- `--space-2xs`: `0.25rem` (4px)
- `--space-xs`: `0.5rem` (8px)
- `--space-sm`: `0.75rem` (12px)
- `--space-md`: `1rem` (16px)
- `--space-lg`: `1.5rem` (24px)
- `--space-xl`: `2rem` (32px)
- `--space-2xl`: `3rem` (48px)
- `--space-3xl`: `4.5rem` (72px)
- `--container-max`: `1400px`

### Border Radii
- `--radius-xs`: `3px` – Badges, status pills, code chips
- `--radius-sm`: `6px` – Input fields, select dropdowns, card skeletons
- `--radius-md`: `10px` – Modal dialogs, floating toasts, large hero banners
- `--radius-lg`: `16px` – Feature cards
- `--radius-pill`: `9999px` – Buttons, pagination controls, search bar pill

---

## 5. Shared Component Primitives

### Button System (`.btn`)
- `.btn`: Primary action. Malachite green pill `#244132`, white text, soft elevation, hover `#1c3427`, active scale(0.99).
- `.btn.btn-outline`: Secondary action. Pure white surface, malachite border, hover bone tint.
- `.btn.btn-accent`: Promotional / seasonal action. Muted antique brass `#ab7a24`.
- `.btn.btn-cancel`: Quiet secondary cancel. White surface with subtle red border, turns tinted red on hover.
- `.btn.btn-danger`: Irreversible destructive action. Solid crimson `#b3261a`.
- `.btn.btn-sm`: Compact rows, table actions, small cards.
- `.btn.btn-block`: Full-width mobile actions.
- `.link-btn`: Bare inline action with underline hover and focus ring.

### Form Inputs & Selects
- `<app-state-city-select>`:
  - Custom SVG dropdown chevron.
  - Stone border (`--color-border`) and soft focus glow (`0 0 0 3px rgba(36, 65, 50, 0.12)`).
  - High-contrast labels with `--color-muted`.
- `<app-phone-input>`:
  - Seamlessly unified group with pre-fixed `+91` code pill and phone input.
- Focus visibility:
  - Clean keyboard navigation ring: `outline: 2px solid var(--color-brand); outline-offset: 2px;`

### Notification & Feedback Primitives
- `<app-toast-container>`:
  - Elevated obsidian-forest card (`#15271d`) with subtle translucent border.
  - Left indicator bar and live countdown timer bar.
  - Smooth spring pop-in and slide-out.
- `<app-confirm-dialog>`:
  - Backdrop blur modal (`backdrop-filter: blur(4px)`).
  - Fraunces serif emphasis, danger/info icon badges, dual button layout.
- `<app-spinner>`:
  - Dual-ring mineral loader with malachite track and bone base.
- `<app-pager>`:
  - Paged numbers housed inside a tactile pill container.
  - Active page highlighted in solid malachite.
- `<app-breadcrumbs>`:
  - Accessible trail with subtle separators and clear current page label.
- `<app-product-card-skeleton>`:
  - Shimmer placeholder using natural stone bone gradients (`#f2eee6` to `#e5dfd2`).

---

## 6. Accessibility & Motion Guidelines

1. **Contrast Compliance:** Every foreground/background pairing in the design system meets or exceeds WCAG AA (minimum 4.5:1 for normal text, 3:1 for large text).
2. **Keyboard Navigation:** All interactive elements (`button`, `a`, `input`, `select`, `textarea`) provide a visible `outline: 2px solid var(--color-brand)`.
3. **Reduced Motion:** When `prefers-reduced-motion: reduce` is detected:
   - All transforms and transitions are shortened to `0.01ms`.
   - Loading spinners slow down to a gentle 1.5s pace to indicate active work without causing vestibular discomfort.
