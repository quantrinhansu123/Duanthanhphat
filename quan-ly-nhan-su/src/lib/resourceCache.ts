/**
 * Cache dữ liệu theo key, dùng chung toàn app (module-level, sống qua các lần chuyển tab).
 * Thuần TypeScript, không phụ thuộc React → test được bằng script.
 * Đăng xuất/đăng nhập đều tải lại cả trang nên cache tự sạch khi đổi tài khoản.
 */
export type Resource<T> = {
  data: T | undefined;
  error: string;
  /** Đang tải lần đầu (chưa có dữ liệu để hiện). */
  loading: boolean;
  /** Đang làm mới ngầm (đã có dữ liệu cũ để hiện). */
  refreshing: boolean;
  /** Lần tải thành công gần nhất (ms), 0 nếu chưa có. */
  at: number;
};

export const EMPTY: Resource<never> = { data: undefined, error: "", loading: false, refreshing: false, at: 0 };

const entries = new Map<string, Resource<unknown>>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Map<string, Set<() => void>>();

export function getResource<T>(key: string): Resource<T> {
  return (entries.get(key) as Resource<T> | undefined) ?? EMPTY;
}

function set<T>(key: string, next: Resource<T>) {
  entries.set(key, next);
  listeners.get(key)?.forEach((fn) => fn());
}

export function subscribe(key: string, fn: () => void) {
  let subs = listeners.get(key);
  if (!subs) listeners.set(key, (subs = new Set()));
  subs.add(fn);
  return () => void subs.delete(fn);
}

/**
 * Tải dữ liệu cho key. Đang có request cùng key → dùng chung (không gọi lại).
 * Lỗi thì giữ nguyên dữ liệu cũ và ghi `error`.
 * Lỗi khi tải được thử lại tối đa `backoffMs.length` lần (mặc định 2: sau 0,5 s và 1,5 s).
 * ponytail: request dùng chung nên không hủy được giữa chừng; kết quả luôn vào cache nên không bị "muộn" sai key.
 */
export function loadResource<T>(key: string, fetcher: () => Promise<T>, backoffMs: number[] = [500, 1500]): Promise<void> {
  const running = inflight.get(key);
  if (running) return running;
  const cur = getResource<T>(key);
  set(key, { ...cur, error: "", loading: cur.data === undefined, refreshing: cur.data !== undefined });
  // Chỉ tải (đọc) mới được thử lại khi lỗi mạng; thao tác ghi không đi qua đây nên không bị ghi đôi.
  const attempt = async (n: number): Promise<T> => {
    try {
      return await fetcher();
    } catch (e) {
      if (n >= backoffMs.length) throw e;
      await new Promise((r) => setTimeout(r, backoffMs[n]));
      return attempt(n + 1);
    }
  };
  const p = attempt(0)
    .then((data) => set(key, { data, error: "", loading: false, refreshing: false, at: Date.now() }))
    .catch((e: unknown) =>
      set(key, { ...getResource<T>(key), error: e instanceof Error ? e.message : String(e), loading: false, refreshing: false }),
    )
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Sửa dữ liệu trong cache tại chỗ (dùng sau khi lưu/xóa một dòng). Chưa có dữ liệu thì bỏ qua. */
export function mutateResource<T>(key: string, updater: (current: T) => T) {
  const cur = getResource<T>(key);
  if (cur.data === undefined) return;
  set(key, { ...cur, data: updater(cur.data) });
}

/** Còn mới (trong staleMs) thì không cần tải lại. */
export function isFresh(key: string, staleMs: number) {
  const { at } = getResource(key);
  return at > 0 && Date.now() - at < staleMs;
}

export function clearResources() {
  entries.clear();
  inflight.clear();
}
