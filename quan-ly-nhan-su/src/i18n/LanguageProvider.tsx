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
import { deaccent } from "./deaccent";
import { PHRASES as UI_PHRASES } from "./phrases";
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
  const next = PHRASES[core] ?? deaccent(core);
  return next === core ? raw : lead + next + trail;
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
      const core = vi.trim();
      return PHRASES[core] ?? deaccent(vi);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
