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
