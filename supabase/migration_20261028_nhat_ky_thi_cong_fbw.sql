-- Giai đoạn 3: tên công việc FBW trên tuyến theo yêu cầu Word ("Hàn ray chảy giáp mép trên tuyến").
-- Chỉ đổi danh mục; báo cáo đã lưu giữ nguyên nội dung cũ.
update public.danh_muc_cong_viec_bao_cao
set ten = 'Hàn ray chảy giáp mép trên tuyến', updated_at = now()
where ma = 'HAN-CGM-TUYEN';
