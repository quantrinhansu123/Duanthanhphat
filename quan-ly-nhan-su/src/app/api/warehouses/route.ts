import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/server/requireAccess";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseError } from "@/lib/supabase/env";
import type { Warehouse } from "@/lib/warehouses";

const file = "warehouses.json";
export async function GET() {
  const denied = await requireAccess(null);
  if (denied) return denied;
  try { return NextResponse.json({ warehouses: await readPrivateJson<Warehouse[]>(file) ?? [] }); }
  catch (e) { return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 }); }
}
async function save(request: Request, editing: boolean) {
  const denied = await requireAccess("quan-ly-kho", "edit");
  if (denied) return denied;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ error: "Thông tin kho không hợp lệ." }, { status: 400 });
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const address = typeof raw.address === "string" ? raw.address.trim() : "";
    if (!name || !address || name.length > 200 || address.length > 500) return NextResponse.json({ error: "Nhập tên kho (tối đa 200 ký tự) và địa chỉ/vị trí kho (tối đa 500 ký tự)." }, { status: 400 });
    const warehouses = await readPrivateJson<Warehouse[]>(file) ?? [];
    if (editing && !warehouses.some((w) => w.id === raw.id)) return NextResponse.json({ error: "Kho không còn tồn tại." }, { status: 404 });
    if (warehouses.some((w) => (!editing || w.id !== raw.id) && w.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) return NextResponse.json({ error: "Tên kho đã tồn tại." }, { status: 409 });
    const warehouse = { id: editing ? raw.id as string : crypto.randomUUID(), name, address };
    await writePrivateJson(file, editing ? warehouses.map((w) => w.id === warehouse.id ? warehouse : w) : [...warehouses, warehouse]);
    return NextResponse.json({ warehouse });
  } catch (e) { return NextResponse.json({ error: formatSupabaseError(e) }, { status: e instanceof SyntaxError ? 400 : 500 }); }
}
export const POST = (request: Request) => save(request, false);
export const PUT = (request: Request) => save(request, true);
export async function DELETE(request: Request) {
  const denied = await requireAccess("quan-ly-kho", "delete");
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu mã kho." }, { status: 400 });
    const warehouses = await readPrivateJson<Warehouse[]>(file) ?? [];
    if (!warehouses.some((w) => w.id === id)) return NextResponse.json({ error: "Kho không còn tồn tại." }, { status: 404 });
    const { count, error } = await createAdminClient().from("thiet_bi").select("id", { count: "exact", head: true }).contains("thong_so", { warehouseId: id });
    if (error) throw error;
    if (count == null) throw new Error("Chưa xác minh được thiết bị đang gán kho. Vui lòng thử lại.");
    if (count) return NextResponse.json({ error: "Kho đang được gán cho thiết bị. Chuyển thiết bị sang kho khác hoặc bỏ gán kho trước khi xóa." }, { status: 409 });
    await writePrivateJson(file, warehouses.filter((w) => w.id !== id));
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 }); }
}
