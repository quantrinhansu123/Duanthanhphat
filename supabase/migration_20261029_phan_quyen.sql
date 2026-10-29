-- Phân quyền ở tầng database: bảng quyền (đồng bộ từ /cau-hinh mỗi lần bấm "Lưu thay đổi"),
-- hàm app_can() và trigger chặn ghi/xóa theo quyền Sửa / Xóa.
-- Dùng trigger (không dùng RLS) để chặn cả khi ghi qua hàm RPC security definer, và không phải bật RLS trên bảng nào.
-- Bỏ qua: service_role (máy chủ Next.js, đã tự kiểm tra ở API) và kết nối trực tiếp không có JWT (migration, SQL editor).
-- Chưa có tài khoản nào được đồng bộ (hoặc email không có trong danh sách) → app_can() = true, app vẫn chạy như cũ.

create table if not exists public.tai_khoan_phan_quyen (
  email text primary key,
  role text not null,
  status text not null default 'Hoạt động'
);

create table if not exists public.phan_quyen (
  role text not null,
  tab_id text not null,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  primary key (role, tab_id)
);

-- Chỉ service_role (máy chủ Next.js) được đọc/ghi hai bảng này.
alter table public.tai_khoan_phan_quyen enable row level security;
alter table public.phan_quyen enable row level security;

create or replace function public.app_can(tabs text[], act text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_role text;
  v_status text;
begin
  if auth.uid() is null then return false; end if;
  select role, status into v_role, v_status from public.tai_khoan_phan_quyen where lower(email) = v_email;
  if not found then return true; end if;
  if v_status = 'Khóa' then return false; end if;
  return exists (
    select 1 from public.phan_quyen p
    where p.role = v_role
      and p.tab_id = any (tabs)
      and case act when 'view' then p.can_view when 'edit' then p.can_edit else p.can_delete end
  );
end;
$$;

revoke all on function public.app_can(text[], text) from public;
grant execute on function public.app_can(text[], text) to authenticated;

create or replace function public.enforce_phan_quyen()
returns trigger
language plpgsql
as $$
begin
  if auth.jwt() is null or coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if not public.app_can(tg_argv[0]::text[], case tg_op when 'DELETE' then 'delete' else 'edit' end) then
    raise exception 'Bạn không có quyền thực hiện thao tác này.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Bảng → các chức năng (id tab trong navigation) được phép ghi vào bảng đó.
do $$
declare
  r record;
  v_tabs text[];
  v_map jsonb := '{
    "bao_cao_ngay": ["bc-bao-cao-ngay"],
    "bao_cao_ngay_cong_viec": ["bc-bao-cao-ngay"],
    "bao_cao_ngay_su_co": ["bc-bao-cao-ngay"],
    "bao_cao_ngay_thiet_bi": ["bc-bao-cao-ngay"],
    "cap_dau_hang_ngay": ["lich-su-cap-nhien-lieu", "bc-bao-cao-ngay"],
    "chung_chi": ["chung-chi", "ho-so-tho-han", "khoa-dao-tao", "tra-cuu-dao-tao", "nhat-ky-han", "lich-su-han", "bien-ban-moi-han"],
    "chung_chi_nhom": ["chung-chi", "ho-so-tho-han", "khoa-dao-tao", "tra-cuu-dao-tao"],
    "dao_tao": ["khoa-dao-tao", "tra-cuu-dao-tao"],
    "dao_tao_hoc_vien": ["khoa-dao-tao", "tra-cuu-dao-tao"],
    "du_an": ["quan-ly-du-an"],
    "ho_so_nghiem_thu": ["bien-ban-moi-han", "nhat-ky-han"],
    "ho_so_nghiem_thu_sua_doi": ["bien-ban-moi-han", "nhat-ky-han"],
    "kiem_tra_may_truoc_ca": ["kiem-tra-may-truoc-ca"],
    "lich_su_bao_tri_may": ["lich-bao-tri"],
    "lich_su_moi_han": ["nhat-ky-han", "bien-ban-moi-han", "bc-moi-han-theo-nam", "lich-su-han", "ban-do", "lwr-track-map", "lich-su-moi-han-loi"],
    "nhan_su": ["ho-so-tho-han", "chung-chi", "khoa-dao-tao"],
    "phan_cong_may": ["phan-cong-may"],
    "phu_tung_thay_the": ["phu-tung-thay-the"],
    "tai_lieu": ["tai-lieu", "khoa-dao-tao", "tra-cuu-dao-tao"],
    "thiet_bi": ["danh-sach-may", "kiem-tra-may-truoc-ca", "phan-cong-may", "lich-bao-tri", "phu-tung-thay-the", "thu-vien-loi"],
    "thu_vien_loi_thiet_bi": ["thu-vien-loi"],
    "tieu_chuan_nghiem_thu_moi_han": ["bien-ban-moi-han", "nhat-ky-han"],
    "toa_do": ["ban-do", "lwr-track-map", "lwr-cong-trinh", "lwr-giai-toa-ung-suat"]
  }';
begin
  for r in select key as t, value as tabs from jsonb_each(v_map) loop
    continue when to_regclass('public.' || r.t) is null;
    select array(select jsonb_array_elements_text(r.tabs)) into v_tabs;
    execute format('drop trigger if exists perm_guard on public.%I', r.t);
    execute format(
      'create trigger perm_guard before insert or update or delete on public.%I for each statement execute function public.enforce_phan_quyen(%L)',
      r.t, v_tabs::text);
  end loop;
end $$;
