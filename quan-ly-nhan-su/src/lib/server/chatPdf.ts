import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Đọc lớp chữ trước, để PDF văn bản không phải render ảnh qua nhiều lượt công cụ. */
export async function readChatPdf(path: string): Promise<string | null> {
  if (!/\.pdf$/i.test(path)) return null;
  try {
    const { stdout } = await run("python", ["-c", `
import fitz, json, sys
with fitz.open(sys.argv[1]) as doc:
    pages = []
    length = 0
    for page in doc:
        text = page.get_text().strip()
        if len(text) < 40:
            print("null")
            break
        pages.append(text)
        length += len(text)
        if length > 60000:
            print("null")
            break
    else:
        print(json.dumps("\\n\\n".join(pages) or None))
`, path], { timeout: 5000, maxBuffer: 1024 * 1024, windowsHide: true });
    return JSON.parse(stdout) as string | null;
  } catch {
    return null; // Python thiếu, PDF scan/lỗi hoặc quá lớn → giữ luồng đọc tệp bằng công cụ.
  }
}
