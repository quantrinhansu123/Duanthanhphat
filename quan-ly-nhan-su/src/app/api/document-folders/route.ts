import { NextResponse } from "next/server";
import { listStoredDocuments, updateStoredDocument } from "@/lib/documentStorage";
import { requireAccess } from "@/lib/server/requireAccess";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";
import { formatSupabaseError } from "@/lib/supabase/env";

const FILE_PATH = "document-folders.json";
const MAX_FOLDERS = 500;
const MAX_DEPTH = 5;

const readFolders = async () => (await readPrivateJson<string[]>(FILE_PATH)) ?? [];
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });
const lower = (s: string) => s.toLocaleLowerCase("vi");
const inTree = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
const sortPaths = (paths: string[]) => [...paths].sort((a, b) => a.localeCompare(b, "vi"));

class InputError extends Error {}
const failure = (e: unknown) =>
  e instanceof InputError ? fail(e.message, 400) : fail(e instanceof Error ? e.message : formatSupabaseError(e), 500);

/** Tên một cấp thư mục: gọn khoảng trắng, không chứa "/". */
function cleanName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (!name) throw new InputError("Nhập tên thư mục.");
  if (name.includes("/")) throw new InputError('Tên thư mục không được chứa dấu "/".');
  return name;
}

/**
 * Thư mục tài liệu do người dùng tự tạo, lưu dạng đường dẫn "Cha/Con/Cháu".
 * Tài liệu gắn thư mục qua thuoc_tinh.thu_muc = đường dẫn đầy đủ.
 */
export async function GET() {
  const denied = await requireAccess("tai-lieu", "view");
  if (denied) return denied;
  try {
    return NextResponse.json({ folders: sortPaths(await readFolders()) });
  } catch (e) {
    return fail(formatSupabaseError(e), 500);
  }
}

export async function POST(request: Request) {
  const denied = await requireAccess("tai-lieu", "edit");
  if (denied) return denied;
  try {
    const body = (await request.json()) as { name?: unknown; parent?: unknown };
    const name = cleanName(body.name);
    const parent = typeof body.parent === "string" ? body.parent : "";
    const folders = await readFolders();
    if (parent && !folders.includes(parent)) return fail("Thư mục cha không tồn tại.", 404);
    const path = parent ? `${parent}/${name}` : name;
    if (path.split("/").length > MAX_DEPTH) return fail(`Tối đa ${MAX_DEPTH} cấp thư mục.`, 400);
    if (folders.some((f) => lower(f) === lower(path))) return fail(`Thư mục "${name}" đã tồn tại.`, 409);
    if (folders.length >= MAX_FOLDERS) return fail("Đã đạt số thư mục tối đa.", 400);
    const next = sortPaths([...folders, path]);
    await writePrivateJson(FILE_PATH, next);
    return NextResponse.json({ folders: next, created: path });
  } catch (e) {
    return failure(e);
  }
}

/** Đổi tên một thư mục: kéo theo mọi thư mục con và tài liệu bên trong. */
export async function PATCH(request: Request) {
  const denied = await requireAccess("tai-lieu", "edit");
  if (denied) return denied;
  try {
    const body = (await request.json()) as { path?: unknown; name?: unknown };
    const path = typeof body.path === "string" ? body.path : "";
    const name = cleanName(body.name);
    const folders = await readFolders();
    if (!folders.includes(path)) return fail("Thư mục không tồn tại.", 404);
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const target = parent ? `${parent}/${name}` : name;
    if (target === path) return NextResponse.json({ folders: sortPaths(folders), created: target });
    if (folders.some((f) => lower(f) === lower(target) && lower(f) !== lower(path))) {
      return fail(`Thư mục "${name}" đã tồn tại.`, 409);
    }
    const remap = (p: string) => `${target}${p.slice(path.length)}`;
    // ponytail: cập nhật tuần tự từng tài liệu; lỗi giữa chừng có thể để lại vài tài liệu mang tên cũ.
    for (const doc of await listStoredDocuments()) {
      const folder = doc.appProperties?.thu_muc;
      if (folder && inTree(folder, path)) await updateStoredDocument(doc.id, { folder: remap(folder) });
    }
    const next = sortPaths(folders.map((f) => (inTree(f, path) ? remap(f) : f)));
    await writePrivateJson(FILE_PATH, next);
    return NextResponse.json({ folders: next, created: target });
  } catch (e) {
    return failure(e);
  }
}

/** Xóa thư mục cùng các thư mục con — chỉ khi không còn tài liệu nào bên trong. */
export async function DELETE(request: Request) {
  const denied = await requireAccess("tai-lieu", "delete");
  if (denied) return denied;
  try {
    const path = new URL(request.url).searchParams.get("path")?.trim();
    if (!path) return fail("Thiếu thư mục cần xóa.", 400);
    const inUse = (await listStoredDocuments()).some((d) => {
      const folder = d.appProperties?.thu_muc;
      return folder ? inTree(folder, path) : false;
    });
    if (inUse) return fail("Thư mục (hoặc thư mục con) còn tài liệu — chuyển hoặc xóa tài liệu trước.", 409);
    const next = (await readFolders()).filter((f) => !inTree(f, path));
    await writePrivateJson(FILE_PATH, next);
    return NextResponse.json({ folders: next });
  } catch (e) {
    return failure(e);
  }
}
