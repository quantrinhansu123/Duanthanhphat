# Design System Master File: Industrial Operations & Welding Management (Thành Phát)

> **LOGIC:** When building or upgrading any screen, component, or visual style, strictly adhere to the rules and design tokens documented in this Master file.
> **Style Profile:** **Soft UI Evolution** — Evolved tactile depth, refined multi-layer soft shadows, balanced micro-borders, crisp industrial typography, accessible high contrast, and responsive fluid layouts.
> **Domain:** Mechanical, Rail & Steel Welding Operations, Personnel, Equipment Maintenance, Welder Certifications, Weld Joint Traceability, Quality Control, and Operational Analytics.

---

## 1. Design Philosophy: Soft UI Evolution

Soft UI Evolution bridges the gap between clean flat enterprise design and tactile neumorphic depth:
1. **Subtle Elevation Layers:** Uses dual-layer diffused shadows rather than harsh dark drop-shadows or murky neumorphic cutouts.
2. **Crisp Micro-Borders:** Every card, container, and input has a clean 1px boundary (`#E2E8F0` / `#CBD5E1`) paired with a soft background gradient or solid white surface.
3. **High Information Density with Breathability:** Optimized padding (compact 12-16px in tables/cards) with 8-12px inner element gaps.
4. **Accessible Contrast (WCAG AA/AAA):** Text contrast ≥ 4.5:1 on normal text, 3:1 on large text/icons. No low-contrast gray-on-gray.
5. **Fast, Lightweight Interactions:** 150ms–200ms subtle transitions (hover lift of 1px, subtle color shifts), avoiding gratuitous or heavy animations.

---

## 2. Color Palette & Design Tokens

### 2.1 Brand & Neutral Tokens

| Token Name | Hex Code | Tailwind / Variable | Usage |
|---|---|---|---|
| **Cobalt Primary** | `#0047AB` | `bg-[#0047AB]`, `--cobalt` | Primary actions, key badges, brand markers |
| **Cobalt Hover** | `#00388A` | `bg-[#00388A]`, `--cobalt-hover` | Button hover, active link highlights |
| **Cobalt Active** | `#002D6E` | `bg-[#002D6E]`, `--cobalt-active` | Button pressed state |
| **Cobalt Light Surface** | `#EFF6FF` | `bg-blue-50/70`, `--cobalt-light` | Active nav items, table highlight rows, info cards |
| **Deep Industrial Navy** | `#071633` | `bg-[#071633]`, `--cobalt-dark` | Sidebar background, modal headers, high-level accents |
| **Deep Steel Navy** | `#0A254F` | `bg-[#0A254F]`, `--cobalt-mid` | Sidebar hovered items, sub-headers |
| **App Background** | `#F8FAFC` | `bg-slate-50`, `--background` | Global main viewport background |
| **Surface (Card/Modal)** | `#FFFFFF` | `bg-white`, `--surface` | Cards, tables, modals, dropdown menus |
| **Surface Muted** | `#F1F5F9` | `bg-slate-100`, `--surface-muted` | Secondary button bg, table header, search bars |
| **Surface Subtle** | `#F8FAFC` | `bg-slate-50/80`, `--surface-subtle` | Table alternating rows, code snippets |

### 2.2 Typography Colors

| Token Name | Hex Code | Tailwind Equivalent | Usage |
|---|---|---|---|
| **Text Primary** | `#0F172A` | `text-slate-900` | Headings, main table values, strong labels |
| **Text Secondary** | `#334155` | `text-slate-700` | Body text, table cells, form labels |
| **Text Muted** | `#64748B` | `text-slate-500` | Secondary descriptions, timestamps, subtitles |
| **Text Subtle / Placeholder** | `#94A3B8` | `text-slate-400` | Input placeholders, helper captions, icons |

### 2.3 Semantic & Industrial Status Tokens

| Semantic Role | Foreground (Text) | Background (Surface) | Border | Indicator Dot | Meaning / Usage |
|---|---|---|---|---|---|
| **Success (Đạt / Hoạt động)** | `#15803D` (`text-emerald-700`) | `#ECFDF5` (`bg-emerald-50`) | `#A7F3D0` (`border-emerald-200`) | `#10B981` | Đạt chuẩn, Hoạt động tốt, Đã phê duyệt, Chứng chỉ hiệu lực |
| **Warning (Cảnh báo / Sắp hết hạn)** | `#B45309` (`text-amber-700`) | `#FFFBEB` (`bg-amber-50`) | `#FDE68A` (`border-amber-200`) | `#F59E0B` | Sắp hết hạn (<30 ngày), Đang bảo trì, Cần kiểm tra, Chờ duyệt |
| **Danger / Error (Lỗi / Hỏng / Quá hạn)** | `#B91C1C` (`text-rose-700`) | `#FFF1F2` (`bg-rose-50`) | `#FECDD3` (`border-rose-200`) | `#F43F5E` | Mối hàn lỗi (UT/MT), Máy hỏng, Quá hạn kiểm định, Đã khóa |
| **Info / Progress (Đang thực hiện)** | `#0369A1` (`text-sky-700`) | `#F0F9FF` (`bg-sky-50`) | `#BAE6FD` (`border-sky-200`) | `#0EA5E9` | Đang vận hành, Đang đào tạo, Đã phân công, Thông số kỹ thuật |
| **Neutral / Inactive (Tạm ngưng / Chưa cấp)** | `#475569` (`text-slate-600`) | `#F1F5F9` (`bg-slate-100`) | `#CBD5E1` (`border-slate-300`) | `#94A3B8` | Chưa kích hoạt, Bản nháp, Tồn kho, Không áp dụng |

---

## 3. Typography Standards

- **Primary Font Family:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif` (full Vietnamese diacritics support, optimal legibility).
- **Monospace / Metric Font:** `IBM Plex Mono`, `ui-monospace`, `monospace` (used for IDs, Serial numbers, Machine codes, Welder IDs, Heat numbers, UTM measurements, W/L/H, coordinates).

### Hierarchy Scale

| Level | Size / Line-height | Weight | Tailwind Classes | Target Component |
|---|---|---|---|---|
| **Page Title** | 22px / 28px (`1.375rem`) | SemiBold (600) / Bold (700) | `text-xl sm:text-2xl font-bold tracking-tight text-slate-900` | Topbar view titles, Dashboard main headings |
| **Section Header** | 16px / 24px (`1rem`) | SemiBold (600) | `text-base font-semibold text-slate-900` | Card header, Modal title, Tab section headers |
| **Card Title / Metric** | 24px / 32px (`1.5rem`) | Bold (700) | `text-2xl font-bold text-slate-900 tracking-tight font-mono` | Stat KPI number values |
| **Table Header** | 12px / 16px (`0.75rem`) | Medium (500) / SemiBold (600) | `text-xs font-semibold text-slate-600 uppercase tracking-wider` | Column labels in data tables |
| **Body Standard** | 14px / 20px (`0.875rem`) | Regular (400) / Medium (500) | `text-sm text-slate-700 leading-normal` | Table cells, descriptions, form inputs |
| **Body Compact / Label**| 13px / 18px (`0.8125rem`)| Medium (500) | `text-xs sm:text-[13px] font-medium text-slate-600` | Form labels, helper notes, sidebar links |
| **Badge / Micro** | 11px / 14px (`0.6875rem`)| Medium (500) / SemiBold (600) | `text-[11px] font-medium leading-none` | Status badges, count pills, micro tags |

---

## 4. Soft UI Evolution Elevation & Shadows

```css
/* Multi-layer soft elevation tokens */
--shadow-soft-xs: 0 1px 2px 0 rgba(15, 23, 42, 0.04);
--shadow-soft-sm: 0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04);
--shadow-soft-md: 0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
--shadow-soft-lg: 0 10px 25px -3px rgba(15, 23, 42, 0.10), 0 4px 10px -2px rgba(15, 23, 42, 0.04);
--shadow-soft-xl: 0 20px 35px -5px rgba(15, 23, 42, 0.14), 0 8px 16px -4px rgba(15, 23, 42, 0.06);
--shadow-inner-subtle: inset 0 1px 2px 0 rgba(0, 0, 0, 0.03);
```

### Tailwind Equivalents:
- **Card / Surface:** `shadow-xs hover:shadow-sm border border-slate-200/80 bg-white rounded-xl`
- **Interactive Card:** `transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300`
- **Modal / Sheet:** `shadow-xl border border-slate-200/90 rounded-2xl`
- **Dropdown / Popover:** `shadow-lg border border-slate-200 rounded-xl`
- **Form Controls:** `shadow-xs border border-slate-300/90 focus:border-cobalt focus:ring-3 focus:ring-blue-100/60`

---

## 5. Component Style Specifications

### 5.1 TopBar / Header
- Background: Solid white `bg-white/95 backdrop-blur-md` with border-bottom `border-b border-slate-200/80`.
- Height: Standard 60px (`h-[60px]`).
- Left: Breadcrumb / Active Screen title with category chip.
- Right: Search quick bar, Live Project indicator, Notification Bell with unread pulse, User Avatar with role pill.
- Mobile Hamburger: Clear 40x40px touch button with smooth drawer transition.

### 5.2 Sidebar
- Background: Deep Industrial Navy (`bg-[#071633]`).
- Border: Right border `border-r border-slate-800/80`.
- Logo Section: Crisp icon logo + "THÀNH PHÁT" heading + subtitle "Rail & Steel Operations".
- Navigation Groups: Uppercase group headers `text-[11px] font-semibold text-slate-400/80 tracking-wider px-3 py-1.5`.
- Navigation Links:
  - Default: `text-slate-300 hover:text-white hover:bg-white/10 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150`
  - Active: `bg-blue-600 text-white shadow-sm font-semibold rounded-lg px-3 py-2 text-sm`
  - Badge counts: Pill badge with subtle contrast `bg-white/15 text-white/90 text-xs px-2 py-0.5 rounded-full`.

### 5.3 Buttons
- **Primary Button (`.btn-primary`):**
  `inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] text-white text-sm font-medium shadow-xs transition-all duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer`
- **Secondary Button (`.btn-secondary`):**
  `inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 text-sm font-medium shadow-xs transition-all duration-150 focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer`
- **Destructive Button (`.btn-danger`):**
  `inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-sm font-medium shadow-xs transition-all duration-150 cursor-pointer`
- **Ghost / Icon Button:**
  `inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-150 cursor-pointer`

### 5.4 Form Controls & Inputs
- **Text Input / Select:**
  `w-full px-3 py-2 text-sm rounded-lg border border-slate-300/90 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs transition-all duration-150 hover:border-slate-400 focus:outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100`
- **Label:**
  `block text-xs font-semibold text-slate-700 mb-1.5`
- **Search Bar with Icon:**
  `relative flex items-center` with inset SVG icon on left, 36px/40px height, clear button if value present.
- **Filter Bar Container:**
  `p-3 sm:p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3`

### 5.5 Data Tables (Enterprise Density)
- **Table Container:**
  `overflow-hidden bg-white border border-slate-200/80 rounded-xl shadow-xs`
- **Table Header (`thead`):**
  `bg-slate-50/90 border-b border-slate-200 text-[12px] font-semibold text-slate-600 uppercase tracking-wider`
- **Table Row (`tr`):**
  `border-b border-slate-100 transition-colors duration-100 hover:bg-slate-50/80 last:border-b-0`
- **Table Cell (`td`):**
  `px-3.5 py-3 text-sm text-slate-700 align-middle`
- **Code / Monospace cell:**
  `font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200`
- **Table Pagination Footer:**
  `px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600`

### 5.6 Cards & Stat KPI Widgets
- **Stat Widget Card:**
  `p-4 sm:p-5 bg-white border border-slate-200/80 rounded-xl shadow-xs transition-all duration-200 hover:shadow-sm hover:border-slate-300 flex flex-col justify-between`
- **Metric Top Line:**
  Title in `text-xs font-medium text-slate-500` + Icon in soft rounded badge `p-2 rounded-lg bg-blue-50 text-[#0047AB]`.
- **Metric Main Value:**
  `text-2xl sm:text-3xl font-bold font-mono tracking-tight text-slate-900 mt-2`
- **Metric Subtext / Trend:**
  `text-xs font-medium text-emerald-600 flex items-center gap-1 mt-1.5`

### 5.7 Status Badges & Pills
- Standard classes: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border`
- Dot: `w-1.5 h-1.5 rounded-full`
- Variants:
  - **Active / Success:** `bg-emerald-50 text-emerald-700 border-emerald-200`
  - **Warning / Pending:** `bg-amber-50 text-amber-700 border-amber-200`
  - **Danger / Fault:** `bg-rose-50 text-rose-700 border-rose-200`
  - **Info / Running:** `bg-sky-50 text-sky-700 border-sky-200`
  - **Draft / Inactive:** `bg-slate-100 text-slate-600 border-slate-200`

### 5.8 Modals & Slide-over Drawers
- Backdrop: `fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity`
- Modal Box: `relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden`
- Modal Header: `px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between`
- Modal Body: `p-6 max-h-[calc(85vh-130px)] overflow-y-auto`
- Modal Footer: `px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-3`

---

## 6. Responsive Breakpoint Rules

| Breakpoint | Width | Guidelines for Industrial Dashboard |
|---|---|---|
| **Mobile (`< 640px`)** | 375px - 639px | Single column KPI stacks; Table horizontal scroll with subtle shadow indicators; Sidebar turns into off-canvas drawer; Modal full-width with safe padding. |
| **Tablet (`640px - 1023px`)** | 640px - 1023px | 2-column KPI grid; Condensed table columns with toggleable detail view; Compact filter bar. |
| **Desktop (`1024px - 1279px`)**| 1024px - 1279px| 4-column KPI grid; Full data tables; Fixed 240px sidebar; Sticky topbar. |
| **Large Desktop (`≥ 1280px`)** | 1280px - 1920px| Generous density with max-width container, multi-column analytics, side-by-side inspection cards. |

---

## 7. Quality & Verification Checklist

- [x] All colors use unified design tokens from this master spec.
- [x] Font loaded is `Inter` with `IBM Plex Mono` for data and numbers.
- [x] No emoji icons; clean standard SVGs with proper `aria-hidden` or labels.
- [x] Focus states are visible and keyboard accessible (`focus-visible:ring-2`).
- [x] Buttons and touch targets are at least 38-44px high on touch viewports.
- [x] Micro-transitions are smooth (150-200ms) and respect `prefers-reduced-motion`.
- [x] Tables have responsive horizontal scrolling without breaking outer layouts.
- [x] Business logic, data models, and API integrations remain 100% untouched.
