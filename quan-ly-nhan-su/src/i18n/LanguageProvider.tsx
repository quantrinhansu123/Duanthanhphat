"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PHRASES as UI_PHRASES, ROLE_PARTS } from "./phrases";
import { deaccent, hasVietnameseDiacritics } from "./deaccent";
import { PHRASES_DATA } from "./phrases.data";

// UI_PHRASES thắng khi trùng khóa (bản dịch giao diện chuẩn hơn).
const PHRASES: Record<string, string> = { ...PHRASES_DATA, ...UI_PHRASES };

export type Lang = "vi" | "en";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Dịch một chuỗi tiếng Việt sang ngôn ngữ hiện tại. */
  t: (vi: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "vi",
  setLang: () => {},
  t: (vi) => vi,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

const STORAGE_KEY = "app-lang";
const ATTR_TARGETS = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);

function translate(raw: string): string {
  if (!raw) return raw;
  const lead = raw.match(/^\s*/)?.[0] ?? "";
  const trail = raw.match(/\s*$/)?.[0] ?? "";
  const core = raw.slice(lead.length, raw.length - trail.length);
  if (!core) return raw;
  const exact = PHRASES[core];
  if (exact) return lead + exact + trail;
  // Chuỗi JSX xuống dòng chứa nhiều khoảng trắng/xuống dòng: chuẩn hoá về một khoảng trắng.
  const flat = core.replace(/\s+/g, " ");
  if (flat !== core && PHRASES[flat]) return lead + PHRASES[flat] + trail;

  // "30 ngày" -> "30 days"; tên người có dấu -> không dấu (bản EN dùng tên không dấu thống nhất).
  const days = core.match(/^(\d+) ngày$/);
  if (days) return lead + `${days[1]} days` + trail;
  if (/^\p{Lu}[\p{L}.]*( \p{Lu}[\p{L}.]*){1,6}$/u.test(core) && hasVietnameseDiacritics(core)) return lead + deaccent(core) + trail;
  if (core.includes(", ") && hasVietnameseDiacritics(core) && core.split(", ").every((p) => /^\p{Lu}[\p{L}.]*( \p{Lu}[\p{L}.]*){1,6}$/u.test(p))) return lead + deaccent(core) + trail;
  // "Đã chọn 12 người" -> "12 people selected" (đếm động, không thể liệt kê trong từ điển).
  const picked = core.match(/^Đã chọn (\d+)(?: (người|mục|dự án|nhân sự))?$/);
  if (picked) return lead + `${picked[1]} ${{ "người": "people", "mục": "items", "dự án": "projects", "nhân sự": "staff" }[picked[2] ?? ""] ?? ""} selected`.replace("  ", " ") + trail;
  // Nội dung thông báo (chuông): câu có tên máy/người/ngày chèn động.
  const overdue = core.match(/^(.+) — đã quá hạn (\d+) ngày \(hạn (.+)\)\.$/);
  if (overdue) return lead + `${translate(overdue[1])} — overdue by ${overdue[2]} days (due ${overdue[3]}).` + trail;
  const expiring = core.match(/^Chứng chỉ sắp\/đã hết hạn: (.+)$/);
  if (expiring) return lead + `Certificate expiring/expired: ${translate(expiring[1])}` + trail;
  const maintDue = core.match(/^Máy (.+) đến hạn bảo trì$/);
  if (maintDue) return lead + `Machine ${maintDue[1]} is due for maintenance` + trail;
  const oilLow = core.match(/^(.+) ngày (\S+): mức dầu (\S+) lít dưới định mức (\S+) lít\.$/);
  if (oilLow) return lead + `${translate(oilLow[1])} on ${oilLow[2]}: oil level ${oilLow[3]} L is below the standard of ${oilLow[4]} L.` + trail;
  const items = core.match(/^(\d+) mục$/);
  if (items) return lead + `${items[1]} items` + trail;
  const removeOne = core.match(/^Bỏ (?!chọn)(.+)$/);
  if (removeOne) return lead + `Remove ${removeOne[1]}` + trail;
  const delCourse = core.match(/^Xóa khóa đào tạo (.+)$/);
  if (delCourse) return lead + `Delete training course ${translate(delCourse[1])}` + trail;
  const codeName = core.match(/^([A-Z0-9][\w.\-/]*) — (.+)$/);
  if (codeName) return lead + `${codeName[1]} — ${translate(codeName[2])}` + trail;
  // Giải toả ứng suất LWR: thông báo kết quả có số động.
  // Tooltip/aria của sơ đồ ray (có mã thanh, lý trình chèn động).
  const lineLabel = (value: string) => value.replace(/TUYẾN THƯỢNG|TUYẾN HẠ|Ray trái|Ray phải/g, (part) => PHRASES[part] ?? part);
  const weldAria = core.match(/^Mối hàn (TUYẾN THƯỢNG|TUYẾN HẠ) (Ray trái|Ray phải) (Km\S+)$/);
  if (weldAria) return lead + `Weld ${lineLabel(`${weldAria[1]} ${weldAria[2]}`)} ${weldAria[3]}` + trail;
  const addAfter = core.match(/^Thêm thanh ngắn phía sau (.+)$/);
  if (addAfter) return lead + `Add a short rail after ${lineLabel(addAfter[1])}` + trail;
  const notLaid = core.match(/^(.+) · Chưa rải$/);
  if (notLaid) return lead + `${translate(notLaid[1])} · Not laid` + trail;
  const notLaidAria = core.match(/^(.+): chưa rải thanh ngắn$/);
  if (notLaidAria) return lead + `${notLaidAria[1]}: short rail not laid` + trail;
  const belongsTo = core.match(/^(\S+) thuộc (.+)$/);
  if (belongsTo) return lead + `${belongsTo[1]} belongs to ${translate(belongsTo[2])}` + trail;
  const shortOf = core.match(/^(\S+): thanh ngắn của (.+)$/);
  if (shortOf) return lead + `${shortOf[1]}: short rail of ${shortOf[2]}` + trail;
  const pickEdit = core.match(/^Chọn (.+) để sửa$/);
  if (pickEdit) return lead + `Select ${translate(pickEdit[1])} to edit` + trail;
  const rangeEdit = core.match(/^Sửa phạm vi (.+)$/);
  if (rangeEdit) return lead + `Edit range ${rangeEdit[1]}` + trail;
  const viewLong = core.match(/^Xem thông số thanh dài (.+)$/);
  if (viewLong) return lead + `View long rail parameters ${viewLong[1]}` + trail;
  const gpsPoints = core.match(/^(\d+)\/(\d+) điểm$/);
  if (gpsPoints) return lead + `${gpsPoints[1]}/${gpsPoints[2]} points` + trail;
  const newRails = core.match(/^Thanh mới dài 500 m, nhiệt độ khóa 35°C\. Tuyến hiện tại: (Km .+)\.$/);
  if (newRails) return lead + `New rails are 500 m long with a 35°C locking temperature. Current line: ${newRails[1]}.` + trail;
  const reportAction =core.match(/^(Sửa|In báo cáo|Xóa) (\d{1,2}\/\d{1,2}\/\d{4})$/);
  if (reportAction) return lead + `${{ "Sửa": "Edit", "In báo cáo": "Print report", "Xóa": "Delete" }[reportAction[1]]} ${reportAction[2]}` + trail;
  const yearOnly =core.match(/^Chỉ có năm (\d{4})$/);
  if (yearOnly) return lead + `Year only ${yearOnly[1]}` + trail;
  const exportedRows = core.match(/^Đã xuất ([\d.,]+) bản ghi ra Excel$/);
  if (exportedRows) return lead + `Exported ${exportedRows[1]} records to Excel` + trail;
  const gapNote =core.match(/^Khe hở cấu tạo ag = ([\d.,]+) mm\. Giới hạn dưới dùng Δgiãn tại nhiệt độ cao nhất, giới hạn trên dùng Δco tại nhiệt độ thấp nhất\.$/);
  if (gapNote) return lead + `Construction gap ag = ${gapNote[1]} mm. The lower limit uses Δexp at the highest temperature; the upper limit uses Δcontr at the lowest temperature.` + trail;
  const tempRule =core.match(/^Nhiệt độ < ([\d.,]+)°C: có lực kéo; ≥ ([\d.,]+)°C: giải toả tự nhiên\.$/);
  if (tempRule) return lead + `Temperature < ${tempRule[1]}°C: pull force applies; ≥ ${tempRule[2]}°C: natural release.` + trail;
  const lengthCheck = core.match(/^Kiểm tra chiều dài: (Chưa xác định giới hạn|Đạt|Vượt giới hạn)(?: \(giới hạn ([\d.,]+) m\))?\.$/);
  if (lengthCheck) {
    const verdict = { "Chưa xác định giới hạn": "Limit not determined", "Đạt": "Pass", "Vượt giới hạn": "Exceeds limit" }[lengthCheck[1]];
    return lead + `Length check: ${verdict}${lengthCheck[2] ? ` (limit ${lengthCheck[2]} m)` : ""}.` + trail;
  }
  const anchorRule = core.match(/^Chiều dài neo áp dụng lấy ([\d.,]+) m vì neo thiết kế nhỏ hơn mức tối thiểu\.$/);
  if (anchorRule) return lead + `Applied anchor length is taken as ${anchorRule[1]} m because the design anchor is below the minimum.` + trail;
  const skipPullRule = core.match(/^Nhiệt độ môi trường ≥ ([\d.,]+)°C: giải toả tự nhiên, chiều dài kéo = 0\.$/);
  if (skipPullRule) return lead + `Ambient temperature ≥ ${skipPullRule[1]}°C: natural release, pull length = 0.` + trail;
  const overLimit = core.match(/^Chiều dài ([\d.,]+) m vượt giới hạn ([\d.,]+) m theo bảng tra đã chọn\.$/);
  if (overLimit) return lead + `Length ${overLimit[1]} m exceeds the ${overLimit[2]} m limit of the selected table.` + trail;
  const skipDays =core.match(/^\(bỏ (\d+) ngày nghỉ\)$/);
  if (skipDays) return lead + `(excluding ${skipDays[1]} days off)` + trail;
  const fuelLoadError = core.match(/^Không tải được lịch sử cấp nhiên liệu: (.+)$/);
  if (fuelLoadError) return lead + `Could not load the fuel supply history: ${fuelLoadError[1]}` + trail;
  const pickPart = core.match(/^Chọn phụ tùng (.+)$/);
  if (pickPart) return lead + `Select spare part ${pickPart[1]}` + trail;
  const deletedParts = core.match(/^Đã xóa (\d+) phụ tùng$/);
  if (deletedParts) return lead + `Deleted ${deletedParts[1]} spare parts` + trail;
  // Lịch: "tháng 10 năm 2026" / "thứ bảy, 24/10/2026" (toLocaleDateString vi-VN; CSS mới viết hoa).
  const monthYear = core.match(/^tháng (\d{1,2}) năm (\d{4})$/i);
  if (monthYear) {
    const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(monthYear[1]) - 1];
    if (month) return lead + `${month} ${monthYear[2]}` + trail;
  }
  const weekdayDate = core.match(/^(thứ hai|thứ ba|thứ tư|thứ năm|thứ sáu|thứ bảy|chủ nhật), (.+)$/i);
  if (weekdayDate) {
    const day = { "thứ hai": "Monday", "thứ ba": "Tuesday", "thứ tư": "Wednesday", "thứ năm": "Thursday", "thứ sáu": "Friday", "thứ bảy": "Saturday", "chủ nhật": "Sunday" }[weekdayDate[1].toLowerCase()];
    return lead + `${day}, ${weekdayDate[2]}` + trail;
  }
  // "Nguyễn Văn A · 10:20 · 23/24 đạt": phần đếm động ở cuối dòng.
  const passed = core.match(/^(.*?)\s*(\d+\/\d+) đạt$/);
  if (passed) return lead + `${passed[1] ? `${translate(passed[1])} ` : ""}${passed[2]} passed` + trail;
  // "Nguyễn Đắc Công — Quản trị": tên người bỏ dấu, chức vụ dịch theo từ điển.
  const personRole = core.match(/^(\p{Lu}[\p{L}. ]*) — (.+)$/u);
  if (personRole) return lead + `${deaccent(personRole[1])} — ${translate(personRole[2])}` + trail;
  const savedRows = core.match(/^Đã lưu ([\d.,]+) dòng báo cáo$/);
  if (savedRows) return lead + `Saved ${savedRows[1]} report rows` + trail;
  const supplied = core.match(/^Cấp dầu — đã báo Chỉ huy trưởng và Quản trị viên · (.+)$/);
  if (supplied) return lead + `Oil supply — Site Commanders and Administrators notified · ${supplied[1]}` + trail;
  if (core.startsWith("· ") && PHRASES[core.slice(2)]) return lead + "· " + PHRASES[core.slice(2)] + trail;
  const machineLabel = core.match(/^(Mở thông tin|Thu gọn|Ảnh|Ảnh xe|Ảnh bảo trì) (.+)$/);
  if (machineLabel) {
    const en = { "Mở thông tin": "Open info for", "Thu gọn": "Collapse", "Ảnh": "Photo of", "Ảnh xe": "Vehicle photo", "Ảnh bảo trì": "Maintenance photo" }[machineLabel[1]];
    return lead + `${en} ${translate(machineLabel[2])}` + trail;
  }
  const countUnit = core.match(/^([\d.,]+) (mối|lít)$/);
  if (countUnit) return lead + `${countUnit[1]} ${countUnit[2] === "mối" ? "welds" : "L"}` + trail;
  const hours = core.match(/^([\d.,]+) giờ$/);
  if (hours) return lead + `${hours[1]} h` + trail;
  const wire = core.match(/^Dây hàn: (.+)$/);
  if (wire) return lead + `Wire: ${wire[1]}` + trail;
  const certDeleted = core.match(/^Đã xóa loại chứng chỉ “(.+)”\.$/);
  if (certDeleted) return lead + `Certificate type “${translate(certDeleted[1])}” deleted.` + trail;
  const certExists = core.match(/^Loại chứng chỉ "(.+)" đã có trong danh mục\.$/);
  if (certExists) return lead + `Certificate type "${translate(certExists[1])}" is already in the catalog.` + trail;
  const certExp = core.match(/^(.+) · Hết hạn: (.+)$/);
  if (certExp) return lead + `${translate(certExp[1])} · Expires: ${certExp[2]}` + trail;
  const certEdit = core.match(/^(Sửa|Xóa) loại chứng chỉ (.+)$/);
  if (certEdit) return lead + `${certEdit[1] === "Sửa" ? "Edit" : "Delete"} certificate type ${translate(certEdit[2])}` + trail;
  // Tổ hàn N (N tùy ý) và chức vụ ghép "A - B - C" từ danh mục.
  const team = core.match(/^Tổ hàn (\d+)$/);
  if (team) return lead + `Welding team ${team[1]}` + trail;
  if (core.includes(" - ")) {
    const parts = core.split(" - ").map((part) => ROLE_PARTS[part.trim().toLowerCase()]);
    if (parts.every(Boolean)) return lead + parts.join(" - ") + trail;
    // "Tuyến thượng - Ray trái": dịch từng phần ngăn bởi " - " nếu có phần trong từ điển.
    const pieces = core.split(" - ");
    const translatedPieces = pieces.map((piece) => PHRASES[piece.trim()] ?? piece);
    if (translatedPieces.some((piece, index) => piece !== pieces[index])) return lead + translatedPieces.join(" - ") + trail;
    // Địa danh ghép "Phú Quốc - An Giang": bỏ dấu từng phần như tên riêng.
    const place = /^\p{Lu}[\p{L}.]*( \p{Lu}[\p{L}.]*){0,3}$/u;
    if (hasVietnameseDiacritics(core) && core.split(" - ").every((part) => place.test(part))) return lead + deaccent(core) + trail;
  }

  // "Bùi Huy Toàn · Thợ hàn" / "KCM007-01 · Tổ hợp máy…": dịch từng phần ngăn bởi " · ".
  if (core.includes(" · ")) {
    const parts = core.split(" · ");
    const translated = parts.map((part) => translate(part));
    if (translated.some((part, index) => part !== parts[index])) return lead + translated.join(" · ") + trail;
  }

  // "Xóa lw01" / "Sửa Vùng hạn chế hàn ray": động từ + tên (chỉ khi tên dịch được hoặc là mã có số).
  const verbName = core.match(/^(Xem|Sửa|Xóa) (.+)$/);
  if (verbName) {
    const name = translate(verbName[2]);
    if (name !== verbName[2] || /\d/.test(verbName[2])) return lead + `${{ "Xem": "View", "Sửa": "Edit", "Xóa": "Delete" }[verbName[1]]} ${name}` + trail;
  }

  // Chuỗi động kiểu "1–50 / 13.417 · 50/trang"
  const pageWord = PHRASES["trang"];
  if (pageWord && /\/trang\b/.test(core)) {
    return lead + core.replace(/\/trang\b/g, `/${pageWord}`) + trail;
  }

  return raw;
}

function shouldSkip(el: Element | null): boolean {
  let node: Element | null = el;
  while (node) {
    if (SKIP_TAGS.has(node.tagName)) return true;
    if (node instanceof HTMLElement && node.isContentEditable) return true;
    if (node.getAttribute?.("data-no-i18n") === "true") return true;
    node = node.parentElement;
  }
  return false;
}

function translateTextNode(node: Text) {
  try {
    if (shouldSkip(node.parentElement)) return;
    const orig = node.nodeValue ?? "";
    const next = translate(orig);
    if (next !== orig) node.nodeValue = next;
  } catch {
    /* bỏ qua node lỗi */
  }
}

function translateElementAttrs(el: Element) {
  try {
    for (const attr of ATTR_TARGETS) {
      const value = el.getAttribute(attr);
      if (value == null) continue;
      const next = translate(value);
      if (next !== value) el.setAttribute(attr, next);
    }
  } catch {
    /* bỏ qua */
  }
}

const ATTR_SELECTOR = ATTR_TARGETS.map((a) => `[${a}]`).join(",");

function translateSubtree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      translateTextNode(current as Text);
      current = walker.nextNode();
    }
    const el = root as Element;
    translateElementAttrs(el);
    el.querySelectorAll(ATTR_SELECTOR).forEach(translateElementAttrs);
    // Ô chỉ-đọc (xem chi tiết): giá trị hiển thị cũng cần dịch; ô đang nhập thì giữ nguyên dữ liệu người dùng.
    el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[readonly],textarea[readonly],input:disabled,textarea:disabled").forEach((field) => {
      if (field.type === "number" || field.type === "date" || field.type === "time") return;
      const next = translate(field.value);
      if (next !== field.value) field.value = next;
    });
  } catch {
    /* bỏ qua nhánh lỗi */
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");
  const applyingRef = useRef(false);
  const frameRef = useRef(0);

  // Đọc lựa chọn đã lưu (chỉ chạy phía client sau khi mount).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "vi") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("data-lang", lang);
  }, [lang]);

  // Chế độ EN: quét toàn bộ DOM, bỏ dấu + dịch cụm từ, theo dõi thay đổi về sau.
  useEffect(() => {
    if (lang !== "en") return;

    const flush = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        applyingRef.current = true;
        try {
          translateSubtree(document.body);
        } finally {
          applyingRef.current = false;
        }
      });
    };

    // Quét ngay + vài lần sau để vượt qua giai đoạn hydrate / render chậm.
    flush();
    const timers = [80, 300, 800, 1800].map((ms) => window.setTimeout(flush, ms));

    const observer = new MutationObserver(() => {
      if (applyingRef.current) return;
      flush();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTR_TARGETS],
    });

    return () => {
      cancelAnimationFrame(frameRef.current);
      timers.forEach((t) => window.clearTimeout(t));
      observer.disconnect();
    };
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    // Tải lại để đảm bảo mọi chuỗi (kể cả nội dung đã render) chuyển đúng ngôn ngữ.
    window.location.reload();
  }, []);

  const t = useCallback(
    (vi: string) => {
      if (lang === "vi") return vi;
      return translate(vi);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
