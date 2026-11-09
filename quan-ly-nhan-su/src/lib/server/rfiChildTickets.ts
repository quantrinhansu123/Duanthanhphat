import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { rfiScope } from "@/lib/weldAcceptance";

type Parent = { id: string; du_an_id: string; so_phieu: string; ngay_moi: string; nguoi_lap: string; thong_tin: Record<string, unknown> };

/** The parent acceptance screen must complete the prepared child, not insert another. */
export async function completeExistingRfiGeometry(parentId: string, date: string,
  decisions: { moi_han_id: string; phien_ban: number }[], actor: string) {
  const db = createAdminClient();
  const tickets = await db.from("phieu_nt_tach").select("id,ngay_nghiem_thu").eq("phieu_rfi_id", parentId).eq("loai", "hinh-hoc");
  if (tickets.error) throw tickets.error;
  if (!tickets.data.length) return null;
  const selected = new Set(decisions.map(d => d.moi_han_id));
  if (selected.size !== decisions.length) throw new Error("Danh sách mối bị trùng.");
  for (const ticket of tickets.data) {
    const rows = await db.from("phieu_nt_tach_moi").select("moi_han_id,ket_qua").eq("phieu_id", ticket.id).limit(2001);
    if (rows.error) throw rows.error;
    if (rows.data.length !== selected.size || rows.data.some(r => !selected.has(r.moi_han_id))) continue;
    if (ticket.ngay_nghiem_thu) {
      if (rows.data.some(r => r.ket_qua !== "Đạt")) throw new Error("Phiếu hình học đã chốt với kết quả khác. Mở tab 2 để xem phiếu.");
      return ticket.id as string;
    }
    const result = await db.rpc("chot_phieu_nt_tach", { p_id: ticket.id, p_ngay: date, p_actor: actor,
      p_ket_qua: decisions.map(d => ({ id: d.moi_han_id, phien_ban: d.phien_ban, ket_qua: "Đạt", ly_do: "" })),
    });
    if (result.error) throw result.error;
    return ticket.id as string;
  }
  throw new Error("RFI đã có phiếu hình học. Mở tab 2 để nghiệm thu đầy đủ các mối của phiếu đã tạo.");
}

/** Reconcile legacy parents and recover interrupted requests without replacing results. */
export async function ensureRfiChildTickets(parent: Parent) {
  if (parent.thong_tin?.loai_rfi === "theo-doi") return;
  const db = createAdminClient();
  const links = await db.from("phieu_yeu_cau_nghiem_thu_moi").select("moi_han_id,du_lieu_chot").eq("phieu_id", parent.id).limit(2001);
  if (links.error) throw links.error;
  if (!links.data.length) return;
  if (links.data.length > 2000) throw new Error("RFI vượt giới hạn 2000 mối.");
  const scope = rfiScope(parent.thong_tin);
  for (const kind of ["hinh-hoc", "sieu-am"] as const) {
    if (!(kind === "hinh-hoc" ? scope.geometry : scope.ultrasound)) continue;
    const existing = await db.from("phieu_nt_tach").select("id,ngay_nghiem_thu").eq("phieu_rfi_id", parent.id).eq("loai", kind);
    if (existing.error) throw existing.error;
    // Existing/manual tickets may cover a subset: never add welds to those tickets.
    const hex = createHash("sha256").update(`rfi-child:${parent.id}:${kind}`).digest("hex");
    const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
    if (existing.data.some((t) => t.id !== id || t.ngay_nghiem_thu)) continue;
    const header = await db.from("phieu_nt_tach").upsert({ id, du_an_id: parent.du_an_id, loai: kind,
      so_phieu: `${parent.so_phieu}-${kind === "hinh-hoc" ? "HH" : "SA"}`, ngay_moi: parent.ngay_moi,
      nguoi_lap: parent.nguoi_lap, phieu_rfi_id: parent.id, thong_tin: parent.thong_tin,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (header.error) throw header.error;
    // Stable IDs and insert-only upserts allow retries to finish an incomplete
    // ticket without clearing inspection decisions or creating duplicate rows.
    for (let offset = 0; offset < links.data.length; offset += 100) {
      const rows = links.data.slice(offset, offset + 100).map((link) => ({
        phieu_id: id, loai: kind, moi_han_id: link.moi_han_id,
        ma_lich_su: link.du_lieu_chot?.moi_han?.ma_lich_su,
        du_lieu_chot: { ...link.du_lieu_chot?.kiem_tra, ...link.du_lieu_chot },
      }));
      const inserted = await db.from("phieu_nt_tach_moi").upsert(rows, { onConflict: "phieu_id,moi_han_id", ignoreDuplicates: true });
      if (inserted.error) throw inserted.error;
    }
  }
}

export async function syncProjectRfiChildren(projectId: string) {
  const db = createAdminClient();
  const parents = await db.from("phieu_yeu_cau_nghiem_thu").select("id,du_an_id,so_phieu,ngay_moi,nguoi_lap,thong_tin,trang_thai")
    .eq("du_an_id", projectId).in("trang_thai", ["Đã phát hành", "Đã hoàn thành"]).limit(1000);
  if (parents.error) throw parents.error;
  // Completed historical acceptances stay intact. A draft with no final batch
  // still needs its children even if the old geometry flow closed the parent.
  const batches = await db.from("dot_nghiem_thu").select("phieu_id,thong_tin,phieu_yeu_cau_nghiem_thu!inner(du_an_id)")
    .eq("phieu_yeu_cau_nghiem_thu.du_an_id", projectId).limit(10000);
  if (batches.error) throw batches.error;
  const final = new Set(batches.data.filter(b => b.thong_tin?.draft !== true).map(b => b.phieu_id));
  const draft = new Set(batches.data.filter(b => b.thong_tin?.draft === true).map(b => b.phieu_id));
  for (const parent of parents.data) {
    if (final.has(parent.id)) continue;
    if (parent.trang_thai === "Đã phát hành" || draft.has(parent.id)) await ensureRfiChildTickets(parent);
  }
}
