# KẾ HOẠCH THỰC THI: Đồng bộ & hiện đại hóa toàn bộ Visual UI (project `quan-ly-nhan-su`)

> Copy toàn bộ file này làm prompt cho agent thực thi (Gemini 3.7 Flash) chạy trực tiếp trên project hiện tại.

---

## 0. VAI TRÒ & RÀNG BUỘC TỐI CAO

Bạn là UI/UX engineer. Nhiệm vụ: **chỉ tinh chỉnh phần visual UI** của toàn bộ frontend để giao diện đồng bộ, hiện đại, chuyên nghiệp hơn, hoạt động tốt trên cả desktop và mobile — **KHÔNG thay đổi bố cục tổng thể, KHÔNG thay đổi logic**.

Ràng buộc bắt buộc:

1. **BẮT BUỘC sử dụng skill `ui-ux-pro-max`.** Không được tự thiết kế theo cảm tính.
2. **BẮT BUỘC đọc `SKILL.md` của `ui-ux-pro-max` TRƯỚC KHI làm bất cứ điều gì**, và tuân theo hướng dẫn/dữ liệu tra cứu của skill (styles, palettes, font pairings, UX guidelines, icons, charts...).
3. Nếu có xung đột giữa yêu cầu trong file này và `SKILL.md`, ưu tiên nguyên tắc an toàn: **không đổi layout, không đổi logic**.
4. Làm việc theo đúng **QUY TRÌNH BẮT BUỘC (16 bước)** ở mục 9. Không nhảy bước.

---

## 1. BỐI CẢNH PROJECT (đã xác định sẵn — vẫn phải tự kiểm chứng khi inspect)

- **Framework:** Next.js `16.3.3`, App Router, build bằng `--webpack`.
- **UI runtime:** React `19`.
- **Styling:** Tailwind CSS `v4` — cấu hình theo kiểu **CSS-first** qua `@theme` trong `src/app/globals.css`. **Không có** `tailwind.config.js`. Mọi design token phải khai báo/chuẩn hóa trong `@theme` của `globals.css`.
- **Data layer:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`) — **KHÔNG được đụng tới**.
- **Điểm vào frontend:**
  - `src/app/layout.tsx` — root layout, font, `<body>`.
  - `src/app/page.tsx`, `src/app/[tab]/page.tsx` — routing theo tab.
  - `src/components/AppShell.tsx` — khung app (shell/topbar/clock).
  - `src/components/Sidebar.tsx` — điều hướng chính.
  - `src/components/*` (~28 file) — các màn hình quản lý: nhân sự, thợ hàn, máy móc, phân công máy, bảo trì & lịch bảo trì, chứng chỉ, đào tạo & lịch sử đào tạo, mối hàn / khay hàn / lịch sử hàn, bàn giao thi công, thư viện lỗi, báo cáo chất lượng (dashboard + embed HTML), cấu hình hệ thống, import hàng loạt.
- **Loại sản phẩm:** hệ thống quản lý nội bộ / dashboard vận hành ngành cơ khí – hàn (internal operations / enterprise management system).
- **Lưu ý Next.js:** đây là bản Next.js có breaking changes; theo `AGENTS.md`, đọc guide liên quan trong `node_modules/next/dist/docs/` trước khi sửa file có yếu tố Next-specific. Block agent-notes trong `AGENTS.md` do `next dev` tự sinh — commit kèm, không xóa riêng.
- **Lệnh:** `pnpm build` (hoặc `npm run build`) = `next build --webpack`; `pnpm lint` = `eslint`. Dev: `pnpm dev` (port 3010).

---

## 2. ĐƯỢC PHÉP SỬA (chỉ visual)

Chỉ được chỉnh các khía cạnh giao diện sau:

- color system
- typography, font size, font weight, line-height
- spacing, padding, margin
- border, border radius, shadow
- icon styling
- hover / active / focus / disabled state
- card styling
- button styling
- input / form styling (input, select, textarea, checkbox, radio)
- table styling
- badge
- sidebar styling
- header / topbar styling
- visual hierarchy
- responsive behavior, breakpoint, overflow, wrapping
- mobile navigation presentation
- table presentation trên mobile

Được phép **chuẩn hóa** ở cấp hệ thống:

- design tokens
- global CSS (`src/app/globals.css`)
- Tailwind v4 theme qua `@theme` trong `globals.css`
- shared component styles / class dùng chung

---

## 3. TUYỆT ĐỐI KHÔNG ĐƯỢC THAY ĐỔI

- business logic
- API / backend / database
- route
- authentication / authorization / permission
- state management
- validation
- data flow / API contract
- công thức tính toán
- dữ liệu hiển thị (giá trị, nội dung, thứ tự dữ liệu)
- chức năng hiện có
- thứ tự nghiệp vụ

Ngoài ra:

- **Không thêm hoặc xóa chức năng.**
- **Không tự ý redesign lại toàn bộ layout.**
- **Không thay đổi vị trí hoặc thứ tự các section lớn** nếu không liên quan trực tiếp đến việc xử lý responsive.
- Không đổi tên biến/hàm/prop, không refactor logic, không đổi cấu trúc component tree ngoài mức cần thiết cho responsive (ví dụ thêm 1 wrapper `div` để scroll bảng là chấp nhận được).

---

## 4. GIỮ NGUYÊN BỐ CỤC

**Desktop phải giữ nguyên cấu trúc và bố cục hiện tại.** Chỉ được:

- làm đẹp visual
- cải thiện visual hierarchy
- chuẩn hóa style
- cải thiện khả năng đọc
- cải thiện responsive

**Mobile** — khi cần xử lý, được phép:

- stack các phần tử theo chiều dọc
- wrap nội dung
- collapse navigation (sidebar → drawer/menu)
- horizontal scroll cho table (trong container riêng)
- thay đổi padding / gap
- thay đổi kích thước chữ
- thay đổi width

→ nhưng **không được thay đổi bản chất cấu trúc hoặc chức năng**.

---

## 5. RESPONSIVE — YÊU CẦU KIỂM TRA

Phải kiểm tra và đảm bảo giao diện đúng ở tối thiểu các bề rộng viewport:

`1440px` · `1280px` · `1024px` · `768px` · `640px` · `430px` · `390px` · `375px`

**Desktop (≥1024px) cần:**

- mật độ thông tin tốt, không quá nhiều whitespace thừa
- table dễ đọc
- UI phù hợp dashboard / management system

**Mobile (≤640px) cần:**

- không vỡ layout
- không tràn viewport
- **không xuất hiện horizontal scroll toàn trang**
- button có touch target phù hợp (tối thiểu ~40–44px chiều cao vùng chạm)
- form dễ thao tác
- modal / dialog không vượt quá màn hình (có scroll nội bộ nếu dài)
- sidebar / navigation dùng tốt (drawer/collapse)
- table có giải pháp responsive hợp lý (scroll ngang trong container, hoặc chuyển card-list, hoặc ẩn cột phụ — tùy skill `ui-ux-pro-max` khuyến nghị)

---

## 6. PHONG CÁCH

Để `ui-ux-pro-max` **tự phân tích project và chọn một design direction phù hợp**.

**Ưu tiên nếu phù hợp:**

- enterprise dashboard
- management system
- industrial / operations dashboard
- professional internal business application

**Không làm theo phong cách:**

- landing page
- ecommerce
- gaming
- quá nhiều gradient
- quá nhiều hiệu ứng
- màu sắc quá sặc sỡ

---

## 7. DESIGN SYSTEM — CHUẨN HÓA

Khai báo/đồng bộ đầy đủ các token màu (trong `@theme` của `globals.css`, đặt tên nhất quán):

`primary` · `secondary` · `accent` · `neutral` · `background` · `surface` · `border` · `text-primary` · `text-secondary` · `success` · `warning` · `error` · `info`

Nguyên tắc: **các trạng thái giống nhau phải dùng cùng một màu trên toàn bộ project** (ví dụ mọi badge "Đạt/Hợp lệ" cùng tông `success`, mọi cảnh báo hết hạn cùng tông `warning`, mọi lỗi cùng tông `error`). Rà soát toàn bộ component để loại bỏ màu hard-code lệch chuẩn.

---

## 8. TYPOGRAPHY — CHUẨN HÓA CÁC CẤP

Định nghĩa và áp dụng nhất quán các cấp chữ:

`page title` · `section title` · `card title` · `table header` · `body` · `label` · `helper text` · `metadata` · `badge` · `button`

Mỗi cấp cố định font-size / font-weight / line-height / color. Không để mỗi màn hình một kiểu.

---

## 9. QUY TRÌNH BẮT BUỘC (thực hiện đúng thứ tự)

1. **Load skill `ui-ux-pro-max`.**
2. **Đọc `SKILL.md`** của skill (và tài nguyên tra cứu liên quan).
3. **Inspect toàn bộ frontend codebase** (`src/app/**`, `src/components/**`, `src/app/globals.css`).
4. Xác định **framework & styling system** thực tế (xác nhận Next.js App Router + Tailwind v4 CSS-first).
5. Xác định **shared components / class dùng chung / pattern lặp lại**.
6. Xác định **design system hiện tại** (token màu, scale chữ, spacing, radius, shadow đang dùng — kể cả giá trị hard-code).
7. **Phát hiện các điểm UI chưa đồng nhất** (màu lệch, khoảng cách lệch, kích thước chữ lệch, style button/table/form không nhất quán, state thiếu...). Lập danh sách.
8. **Chọn MỘT design direction** (theo mục 6) và ghi rõ lý do phù hợp với loại project.
9. **Chuẩn hóa shared styles / design tokens TRƯỚC** (`@theme` trong `globals.css`, class/utility dùng chung).
10. **Sửa UI từng phần** theo component, bám vào token vừa chuẩn hóa.
11. **Kiểm tra desktop** (1440 / 1280 / 1024).
12. **Kiểm tra tablet** (768).
13. **Kiểm tra mobile** (640 / 430 / 390 / 375).
14. **Chạy build:** `pnpm build` (fallback `npm run build`).
15. **Chạy lint/typecheck:** `pnpm lint` (và `tsc --noEmit` nếu khả dụng).
16. **Sửa mọi lỗi UI hoặc responsive phát sinh** cho tới khi build + lint sạch và 8 breakpoint đều đạt.

---

## 10. CÁC COMPONENT CẦN KIỂM TRA & ĐỒNG BỘ

`sidebar` · `header / topbar` · `buttons` · `cards` · `forms` · `input` · `select` · `textarea` · `checkbox` · `radio` · `tabs` · `badges` · `tables` · `pagination` · `modal / dialog` · `dropdown` · `tooltip` · `empty state` · `loading state` · `error state`

Mỗi loại phải có style thống nhất trên toàn project (kể cả các state hover/active/focus/disabled).

---

## 11. BÁO CÁO SAU KHI HOÀN THÀNH (bắt buộc, ngắn gọn)

Trình bày:

- **Design direction đã chọn** (và lý do).
- **Bảng màu chính** (danh sách token + mã màu).
- **Typography** (các cấp + thông số).
- **Responsive strategy** (cách xử lý sidebar, table, modal, form trên mobile; các breakpoint đã dùng).
- **Component nào đã chỉnh.**
- **File nào đã sửa** (danh sách đường dẫn).
- **Vấn đề UI nào đã khắc phục** (đối chiếu danh sách ở bước 7).

Và **xác nhận rõ ràng**:

- ✅ Không thay đổi business logic
- ✅ Không thay đổi API
- ✅ Không thay đổi dữ liệu
- ✅ Không thay đổi route
- ✅ Không thay đổi bố cục tổng thể

---

## 12. TIÊU CHÍ HOÀN THÀNH (Definition of Done)

- [ ] Đã đọc `SKILL.md` của `ui-ux-pro-max` và áp dụng.
- [ ] Design tokens chuẩn hóa trong `@theme` (`globals.css`), không còn màu/spacing hard-code lệch chuẩn ở component.
- [ ] Typography nhất quán theo 10 cấp.
- [ ] Tất cả component ở mục 10 đồng bộ, đủ các state.
- [ ] 8 breakpoint đều không vỡ layout, mobile không có horizontal scroll toàn trang.
- [ ] `pnpm build` thành công.
- [ ] `pnpm lint` sạch (không thêm lỗi mới).
- [ ] Bố cục desktop giữ nguyên; không có thay đổi logic/API/route/dữ liệu.
- [ ] Đã nộp báo cáo ở mục 11.
