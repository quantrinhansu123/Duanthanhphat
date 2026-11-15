import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

type Pending = { resolve: (text: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; cleanup: () => void };
type Session = { child: ReturnType<typeof spawn>; pending?: Pending; idle?: ReturnType<typeof setTimeout>; ready: boolean };
const runtime = globalThis as typeof globalThis & { __tcwAntiSessions?: Map<string, Session> };
// Giữ phiên qua HMR để không khởi động lại CLI hoặc để tiến trình mồ côi khi sửa giao diện.
const sessions = runtime.__tcwAntiSessions ??= new Map<string, Session>();

function stopSession(key: string, current: Session, message: string) {
  clearTimeout(current.idle);
  clearTimeout(current.pending?.timer);
  current.pending?.cleanup();
  current.pending?.reject(new Error(message));
  current.pending = undefined;
  if (sessions.get(key) === current) sessions.delete(key);
  current.child.stdin?.end();
  current.child.kill();
}

/** stdin NDJSON tránh giới hạn chiều dài dòng lệnh Windows và giữ ngữ cảnh giữa các lượt. */
export async function askAntiCli(key: string, model: string, initialPrompt: string, nextPrompt: string, signal?: AbortSignal, schema?: object, agent?: string): Promise<string> {
  if (signal?.aborted) throw new Error("Yêu cầu đã dừng.");
  let session = sessions.get(key);
  if (!session) {
    const child = spawn("agy", ["--input-format", "stream-json", "--output-format", "stream-json", "--model", model, "--disable-slash-commands", ...(schema ? ["--json-schema", JSON.stringify(schema)] : []), ...(agent ? ["--agent", agent] : [])], {
      cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "ignore"],
    });
    session = { child, ready: false };
    sessions.set(key, session);
    const current = session;
    const fail = (message: string) => stopSession(key, current, message);
    createInterface({ input: child.stdout! }).on("line", (line) => {
      let event;
      try { event = JSON.parse(line); } catch { return; }
      if (event.event !== "result" || !current.pending) return;
      const result = event.result;
      const response = schema && result?.structured_output && typeof result.structured_output === "object" ? JSON.stringify(result.structured_output) : result?.response;
      if (result?.status !== "SUCCESS" || typeof response !== "string" || !response.trim()) {
        fail(typeof result?.error === "string" ? `Anti CLI: ${result.error}` : "Anti CLI không trả về nội dung.");
        return;
      }
      clearTimeout(current.pending.timer);
      current.pending.cleanup();
      current.pending.resolve(response.trim());
      current.pending = undefined;
      current.ready = true;
      current.idle = setTimeout(() => fail("Phiên Anti CLI đã hết thời gian chờ."), 5 * 60_000);
      current.idle.unref();
    });
    child.on("error", () => fail("Không khởi động được Anti CLI. Kiểm tra lệnh agy và trạng thái đăng nhập trên máy chủ."));
    child.stdin!.on("error", () => fail("Mất kết nối với Anti CLI. Vui lòng gửi lại."));
    child.on("close", () => fail("Anti CLI đã đóng kết nối trước khi trả lời xong."));
  }
  if (session.pending) throw new Error("Anti CLI đang xử lý tin nhắn trước, vui lòng đợi.");
  clearTimeout(session.idle);
  const current = session;
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => stopSession(key, current, "Anti CLI chưa hoàn tất sau 90 giây. Kiểm tra trạng thái tác vụ trước khi gửi lại."), 90_000);
    const abort = () => stopSession(key, current, "Yêu cầu đã dừng.");
    current.pending = { resolve, reject, timer, cleanup: () => signal?.removeEventListener("abort", abort) };
    signal?.addEventListener("abort", abort, { once: true });
    current.child.stdin!.write(JSON.stringify({ event: "user", message: { content: current.ready ? nextPrompt : initialPrompt } }) + "\n");
  });
}
