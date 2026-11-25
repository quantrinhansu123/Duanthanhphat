# Mục tiêu và phương án áp dụng TB 10015 cho ray hàn liền

## Mục tiêu

- Dùng thông số đã lưu của từng thanh ray hàn dài để tính các đại lượng theo TB 10015-2012 ngay trong ứng dụng quản lý hàn ray.
- Cho phép kỹ sư đối chiếu đầu vào, đơn vị, kết quả và ô công thức nguồn trong cùng một tab.
- Xác định dữ liệu cần bổ sung để kiểm toán độ bền, ổn định và nhiệt độ khóa ray thiết kế theo từng đoạn tuyến.

## Phương án sử dụng dữ liệu hiện tại

1. Trong **Quản lý hàn ray LWR → Công thức TB 10015**, chọn dự án và mã thanh ray. Ứng dụng đọc thanh đã lưu trong sơ đồ và hồ sơ giải tỏa ứng suất trên Supabase.
2. Chọn **Bản rút gọn** để xem kết quả chính. Chọn **Bản đầy đủ** để đối chiếu toàn bộ đầu vào và công thức của phần tính theo hồ sơ. Ô `Nhập liệu!D13` trong Excel chọn loại 50, 60 hoặc 75 kg/m. Với `60R2` và `PB43`, phép tính nhiệt dùng diện tích của thanh trong hồ sơ.
3. Tính dải khóa từ nhiệt độ khóa đang lưu và biên độ khóa. Từ dải khóa và nhiệt độ ray cực trị, tính biên độ tăng giảm nhiệt, lực kéo nén nhiệt, ứng suất kéo nhiệt, khe đứt và chiều dài vùng co giãn. Khe đứt được so với ngưỡng lưu trong hồ sơ thanh.
4. Bấm địa chỉ ô ở cột **Excel** để xem công thức và giá trị mẫu. Mục **Excel gốc** tra cứu 11 bảng với 1.675 ô công thức. Mục **Hướng dẫn** giải thích mục đích, cách thao tác, quy đổi đơn vị và phương pháp tính.

Với bộ thông số mẫu loại ray 60 kg/m trong Excel, khe đứt tại ô `3_Khe đứt ray!D10` là **54,42 mm** và ngưỡng tại ô `D11` là **70 mm**. Phép tính trong ứng dụng cho cùng kết quả khi dùng cùng đầu vào.

## Phương án hoàn thiện kiểm toán thiết kế

| Hạng mục | Đầu vào cần xác nhận | Kết quả cần có |
| --- | --- | --- |
| Cường độ ray | Mác thép, độ mòn, đặc trưng mặt cắt, sơ đồ tải bánh và cự ly trục, tốc độ, độ cứng gối đỡ và tải dọc bổ sung nếu có | Tổng ứng suất, ứng suất cho phép, độ giảm nhiệt cho phép |
| Ổn định đường ray | Kiểu kết cấu, tà vẹt, sức cản ngang, sai lệch hình học và bán kính theo đoạn | Độ tăng nhiệt cho phép |
| Nhiệt độ khóa ray thiết kế | Nhiệt độ ray cực trị theo đoạn và các giới hạn từ kiểm toán cường độ, ổn định, khe đứt | Khoảng nhiệt độ khóa khả dụng và nhiệt độ khóa thiết kế |
| Cầu và ghi | Thông số kết cấu, liên kết và tải trọng tại vị trí công trình | Các phép kiểm riêng theo điều kiện bố trí. Cầu nhịp lớn cần phân tích tương tác cầu–ray theo điều 4.3.2 khi kiểm tra đứt ray |

Điều 1.0.2 của TB 10015-2012 quy định phạm vi đường khổ tiêu chuẩn 1.435 mm. Khi bổ sung bộ dữ liệu thiết kế, đối chiếu từng nhóm kết quả với Excel bằng cùng đầu vào và lưu nguồn thông số theo đoạn để phục vụ thẩm tra.

## Đối chiếu 15 slide Part I và bảng tính thiết kế

Đọc các công thức trong ảnh nhúng cùng phần chữ. Tham chiếu [văn bản TB 10015-2012](https://i7.antpedia.com/standard/files/pdfs_ora/CN-TB/d32/TB%2010015-2012_0625.pdf), [bản sửa đổi 2024 của Cục Đường sắt Quốc gia Trung Quốc](https://www.nra.gov.cn/xxgk/gkml/ztjg/bzgf/jsbz/202410/P020241010409040465120.pdf) và [QCVN 02:2022/BXD](https://vbpl.vn/FileData/TW/Lists/vbpq/Attachments/156199/VanBanGoc_02-2022-TT-BXD_QCVN_20220928030517391390_signed20220928030757.pdf). Bản sửa đổi cập nhật nhiệt độ tham chiếu, đặc trưng mặt cắt và một số quy định cho cầu. Cơ chế nén nhiệt, vai trò của sức cản nền và sai lệch tuyến được trình bày thêm trong [nghiên cứu hiện trường của FRA](https://railroads.dot.gov/sites/fra.dot.gov/files/fra_net/16446/1995_FIELD%20TESTING%20OF%20HIGH%20DEGREE%20REVENUE%20SERVICE%20TRACK.PDF).

### Nhiệt độ và thông số đầu vào (slide 4–8)

| Công thức hoặc bảng | Cách đọc |
| --- | --- |
| `Tmin = Tmin không khí`, `Tmax = Tmax không khí + 20 °C` | Giả thiết chuyển nhiệt độ không khí sang nhiệt độ ray của slide. Dùng cột cực trị năm A.5/A.6 theo trạm QCVN. Ví dụ Mường Tè 0,8/41,3 °C cho ray 0,8/61,3 °C. Phải chốt trạm đại diện và mô hình nhiệt độ ray cho đoạn thiết kế. |
| `[σ] = σs/K` (3.2.4) | Chia giới hạn chảy của đúng mác thép cho hệ số an toàn 1,3. Mác 472 MPa cho khoảng 363,08 MPa. `F` là diện tích, `Wđỉnh/Wđế` là mô đun chống uốn, `Ix/Iy` là mô men quán tính tương ứng uốn đứng/ngang. Mặt cắt ray mòn phải dùng dòng phù hợp và rà soát đại lượng giữ nguyên trong bảng. |
| Sức cản dọc 3.2.2 | Dạng hai đoạn `r(x) = min(c·abs(x), rmax)` cho độ lớn chuyển vị tương đối x tính bằng mm. Tà vẹt III dưới đầu máy dùng c = 11,6 và rmax = 23,2, dưới toa hoặc không tải dùng 7,5 và 15. Tà vẹt II tương ứng 6,8 và 13,6 hoặc 4,4 và 8,8. WJ-7/8 tương ứng 18,6 và 37,2 hoặc 12 và 24. Phụ kiện đàn hồi V sức cản nhỏ đạt cao nguyên ở 0,5 mm, dưới toa/không tải dùng 16x đến 8. Dòng dưới đầu máy có số bị che trong slide, cần bản nguồn trước khi dùng. Đơn vị r là kN/(m·ray). |
| `u = D/a`, `k = (u/(4EIₓ))^(1/4)` | D là độ cứng gối, a là cự ly gối. Đổi D từ kN/mm sang N/mm và a từ m sang mm trước khi chia. u có đơn vị N/mm², k có đơn vị 1/mm. Với D = 33 và a = 0,6 m, u = 55 N/mm². |
| `q = q₀ − B·y^Z + C·y^(1/N)` (B.0.4-3) | Sức cản ngang phi tuyến của ba lát theo độ lớn chuyển vị ngang y, dùng bộ hệ số và đơn vị cm/N của Phụ lục B. q₀ là sức cản ban đầu. Dùng cho phương pháp bước sóng không đều, tách biệt với Q tương đương của 3.2.3. |
| `M = H·β^(1/μ)` (B.0.4-4) | Mô men cản xoay của phụ kiện theo độ lớn góc xoay β. H và μ tra theo phụ kiện, ψ tham gia mô hình năng lượng của phương pháp B.0.4. β ở đây khác hệ số lệch tải và hệ số độ cứng khung. |
| `Pd = (1+αv)·Pj` (A.0.2-1) | Pj là tải tĩnh một bánh trên một ray, Pd là tải động đứng trên đường thẳng. Với v ≤ 160 km/h, αv là 0,6v/100 cho điện hoặc 0,4v/100 cho diesel. Trên 160 lấy 1. |
| `βtải = 2Δh·H/S² ≈ 0,002Δh` (A.0.2-2/3) | Δh là siêu cao **không cân bằng**, H là chiều cao trọng tâm, S là khoảng cách tim hai ray. Dùng mm cho cả ba. H = 2.300 và S = 1.500 cho hệ số xấp xỉ 0,002. Chọn độ lớn lệch tải để xét phía bất lợi, nhập Δh theo hồ sơ vận hành. f trong A.0.2-2 khuếch đại ứng suất do tác động ngang, tra theo bán kính. |

### Cường độ và giảm nhiệt (slide 6, 9–10)

- **A.0.4-6/7/8/9.** Tại từng bánh i, đặt `zᵢⱼ = k·abs(xᵢ−xⱼ)` với x tính bằng mm. Tính `η=e^(−z)(cos z+sin z)` cho độ lún và `μ=e^(−z)(cos z−sin z)` cho mô men. Cộng tác dụng có dấu của tất cả bánh j. `yᵢ = k·Σ(Pⱼη)/(2u)` là lún mm, `Mᵢ = Σ(Pⱼμ)/(4k)` là mô men N·mm, `Qᵢ = k·a·Σ(Pⱼη)/2` là phản lực gối N. Một bánh là trường hợp tổng có một số hạng. Ảnh slide 9 có thêm P₀ trước hai tổng trong A.0.4-7. Vì Pⱼ đã tính bằng N, nhân P₀ lần nữa sai thứ nguyên. Dùng dạng cộng chồng phù hợp với A.0.4-6 và bảng Excel mẫu.
- **A.0.5-1/2/3.** Lấy M₀ lớn nhất trong các mặt cắt bánh. `Md = M₀(1+αv+βtải)`, rồi `σđỉnh,d = f·Md/Wđỉnh`, `σđế,d = f·Md/Wđế`. Md là công thức A.0.5-1 theo ảnh trích, dù chữ trên slide ghi A.0.5-7. Không nhân Pd thêm lần nữa vào mô men.
- **A.0.5-4/5/6 và 4.1.2.** `σt = E·αnhiệt·ΔTd,max` là kéo nhiệt. Nếu biết lực phụ kéo Pf của một ray, `σf = Pf/F` với Pf tính bằng N. `σz` là ứng suất do kéo/hãm trong tổ hợp áp dụng, xác định từ lực dọc hoặc phân tích phù hợp. Kiểm `σđế,d + σt + σf + σz ≤ [σ]`. Giải ngược được `[ΔTd] = ([σ]−σđế,d−σf−σz)/(E·αnhiệt)`. Tử số âm nghĩa là phần tải không do nhiệt đã vượt giới hạn. Việc loại trừ một ứng suất cần căn cứ tổ hợp của hồ sơ. Tab mới yêu cầu điền rõ hai đại lượng, kể cả khi giá trị được xác nhận là 0.

### Ổn định và cửa sổ khóa (slide 4, 11–12)

- **B.0.3.** Phương pháp thống nhất cho đường có ba lát, tính N–cm. Đặt `f=0,2 cm`, `βkhung=1`, `t=0,17×2,103×10⁻⁶ cm⁻¹`, `1/R′=1/R+8×0,83×2,103×10⁻⁶`. Đường thẳng có `1/R=0`. Đặt `A=2βkhung·E·Iy·π²`, `ω=A(t+4/(π³R′))`, `b=4Q/π³−ωt/f`. Tính `l²=(ω+√(ω²+b·f·A))/b` theo B.0.3-5, `f₀e=t·l²`. Q từ bảng 3.2.3 đổi từ kN/m sang N/cm bằng ×10. Công thức B.0.3-4 là `Pw=(A(f+f₀e)/l²+4Ql²/π³)/(f+f₀e+4l²/(π³R′))`. l là **nửa** bước sóng, Pw là lực tới hạn của **hai ray**. B.0.3-6/7 cho `[P]=Pw/K`, `[ΔTu]=[P]/(2EαnhiệtF)` khi không có lực nén dọc phụ. Trường hợp có lực nén phụ mỗi ray phải xét tổ hợp của B.0.3-8 và công trình liên quan.
- **B.0.4.** Slide 12 để nghiên cứu sau. Excel khảo sát các bước sóng và lấy min của `P(l)=(τᵢ+τq+τm)/τ₀`: năng lượng uốn, sức cản ngang và mô men cản, chia cho hệ số công của lực nén. Cần thẩm tra mô hình và khoảng tìm cực tiểu trước khi tích hợp. Tab mới tính B.0.3.
- **4.4.2/3.** Trên ba lát, `Te = (Tmax+Tmin)/2 + ([ΔTd]−[ΔTu])/2 + δk`. Không ba lát dùng trung bình cực trị cộng δk. Hiệu chỉnh δk trong ±5 °C. Nếu biên khóa là s (thường 5 °C, trường hợp khó khăn 3 °C), hai biên thi công là `Tu=Te+s`, `Td=Te−s`. Kiểm `Tmax−Td ≤ [ΔTu]` và `Tu−Tmin ≤ [ΔTd]`. Khi áp thêm giới hạn khe đứt, biên trên của tâm khóa là `Tmin+min([ΔTd],ΔTλ)−s`. Tab mới còn ràng buộc dải khóa nằm trong cực trị đã nhập và giữ nguyên tâm tính theo công thức để người dùng thấy nếu hiệu chỉnh đã chọn nằm ngoài cửa sổ.

### Khe đứt, vùng đệm, cầu và ghi (slide 13–15)

- **4.3.1.** Lực nhiệt mỗi ray `Pt=EαnhiệtF·ΔT`. Khi đứt ray, khe `λ=EF(αnhiệtΔTd,max)²/r` với r không tải. Dùng N–mm, trong đó 1 kN/m = 1 N/mm. Suy ra `ΔTλ=√([λ]·r/(EF))/αnhiệt`. Đoạn cầu nhịp lớn cần phân tích tương tác theo 4.3.2.
- **4.7.1 và E.0.2.** Với lực ròng `A=Pt−Pj` dương trong miền áp dụng, `ls=A/r`, `Δdài=A²/(2EFr)`, `Δđệm=(A·L−rL²/4)/(2EF)`. Tính riêng nén nóng và kéo lạnh. Khe a₁ tối thiểu bằng tổng chuyển vị hai đầu ở mối ray dài–ray đệm khi nóng, tối đa bằng khe cấu tạo trừ tổng chuyển vị lạnh. Khe a₂ dùng hai đầu ray đệm theo cùng nguyên tắc. Slide 13–14 trỏ đến phần đã có trong ứng dụng, còn Excel có bảng 3 và 5 để tra chi tiết. Tab mới dùng khe đứt trong cửa sổ khóa.
- **Cầu.** Slide 15 chỉ nêu đầu ra. Chương 5/Phụ lục F yêu cầu tính tương tác ray–cầu để có lực co giãn T₁, uốn T₂, đứt ray T₃ và hãm/kéo T₄. Trong miền áp dụng của điều 5.2, một số trường hợp có dạng `T=r·L` và giới hạn lực hoặc chiều dài. Kiểm mố/trụ bằng tổ hợp theo 5.4.3, độ cứng theo bảng 5.4.5/5.4.6 sửa đổi. Dữ liệu bắt buộc gồm nhịp, loại dầm, sơ đồ gối, độ cứng mố/trụ, liên kết, điều kiện biên, nhiệt độ dầm và hoạt tải. Chưa có mô hình đoạn cầu đã thẩm tra để chạy tự động.
- **Ghi.** Slide chỉ liệt kê trong mục lục. Excel tham chiếu `σf=ΔPmax/F`, `2(Pt,max+ΔP′max)≤[P]` và `τ=4T/(πd²)` cho tiết diện cắt của bu lông. Chuyển vị tương đối dùng giãn nhiệt `α·l·ΔT` và dịch chuyển gót/mũi với dấu theo sơ đồ ghi. Ghi trên cầu cần phân tích tương tác riêng.

## Kiểm kê Supabase đang cấu hình cho ứng dụng

Kết quả truy vấn chỉ đọc ngày 24/11/2026.

| Nguồn | Hiện có | Còn thiếu cho vận hành thiết kế |
| --- | --- | --- |
| `tb15_khi_hau` | 151 trạm với cực trị không khí. Đối chiếu 3 trạm đầu với ảnh A.5/A.6. | Liên kết trạm và giả thiết/đo nhiệt độ ray theo đoạn. |
| `tb15_loai_ray`, `tb15_mac_thep` | 12 mặt cắt danh mục 50/60/75 kg/m theo độ mòn và 2 dòng mác thép. F, W và Ix của dòng 60 kg/m chưa mòn khớp bảng C sửa đổi. | Bảng sửa đổi bổ sung 60N/75N, hai loại này chưa có trong danh mục. Dữ liệu mặt cắt đầy đủ và mác được xác nhận cho 60R2/PB43 cũng chưa có, gồm W, Ix, Iy và nguồn. |
| `tb15_ket_cau_duong`, `tb15_do_cung_goi` | 4 kết cấu có r cao nguyên, Q, cự ly gối và 5 dòng độ cứng. | Sức cản dọc theo chuyển vị và theo từng trạng thái đầu máy/toa/không tải, phụ kiện sức cản nhỏ, độ cứng gối theo cấu tạo thực, dữ liệu đo và liên kết theo đoạn. |
| `tb15_on_dinh_nen`, `tb15_mo_men_can` | 2 bộ q₀/B/Z/C/N và 1 bộ H/μ/ψ. | Bộ thông số phụ kiện/đá thực tế và kiểm chứng B.0.4. Bố trí tà vẹt của B.0.4-1 và của Q bảng 3.2.3 cần tra độc lập. |
| `tb15_he_so_tai`, `tb15_so_do_tai`, `tb15_so_do_tai_banh` | 10 dòng hệ số và 1 sơ đồ EMU mẫu với 8 bánh. | Sơ đồ tải đội tàu thực, loại sức kéo, vận tốc, siêu cao không cân bằng, H/S, trường hợp tổ hợp và quy ước chọn hệ số lực ngang. Tab dùng mốc dưới theo danh mục hiện có, với R=0 là đường thẳng. |
| `lwr_long_rails`, `lwr_track_layouts` | 30 hồ sơ (29 loại 60R2, 1 loại PB43) và 3 sơ đồ. Cả 30 có E, α, F, R, nhiệt độ ray cực trị, nhiệt độ khóa, r, lực cản mối nối và ngưỡng khe. | Chưa có trong params của các hồ sơ đã đọc: bộ mặt cắt đầy đủ/mác thép, độ mòn, D/a/Q, vận tốc, Δh, bố trí tải, ứng suất phụ và liên kết phiên bản đầu vào thiết kế. |

## Triển khai và xác minh

1. Đã thêm tab **Kiểm toán nền đường** trong màn hình **Kiểm toán đường ray không mối nối**. Tab đọc danh mục qua API có kiểm tra quyền, hiện nguồn Supabase hoặc JSON dự phòng, yêu cầu người dùng chọn trạm/mặt cắt/kết cấu/tải. Mô hình tính P, M, y, Q theo mặt cắt bánh, cường độ, B.0.3, khe đứt và cửa sổ khóa. Phạm vi chạy thử là đoạn nền đường có ba lát khổ 1.435 mm. Các giá trị catalog và số mặc định phải được đối chiếu trước khi chọn.
2. Kiểm thử hồi quy với cùng bộ dữ liệu Excel. Kết quả mẫu gồm M₀ = 16,501915 kN·m, ứng suất đáy động 104,178759 MPa, giảm nhiệt cho phép 104,478678 °C và tăng nhiệt B.0.3 cho phép 96,157458 °C. Dùng `node scripts/test-tb15-ground.mjs` trong thư mục ứng dụng. Đã chạy thêm bằng dữ liệu đọc trực tiếp từ Supabase với trạm Mường Tè, ray 60 kg/m chưa mòn, tà vẹt III, sơ đồ EMU mẫu, đường thẳng 200 km/h và σf = σz = 0 giả định. Kết quả minh họa là tâm khóa 35,21 °C, khe đứt 23,45 mm và tổng ứng suất đáy 201,84 MPa.
3. Để đưa vào hồ sơ thiết kế, bổ sung cấu hình có phiên bản theo đoạn gồm trạm, mặt cắt và dữ liệu tuyến/tải, nguồn từng giá trị, tổ hợp, kết quả và người thẩm tra. Đối chiếu bảng 50/60/75 với bản sửa đổi 2024, thêm mặt cắt thực tế 60R2/PB43 và bộ tải được duyệt. Liên kết các hồ sơ ray bằng mã mặt cắt xác định, vì cùng khối lượng danh nghĩa có thể có hình học khác nhau.
4. Mở rộng sau khi có bộ dữ liệu và ca kiểm chứng cho B.0.4, kết cấu không ba lát, cầu và ghi. Kiểm toán cầu cần mô hình tương tác phi tuyến và đối chiếu với kết quả thiết kế được thẩm tra. Không có migration hoặc bản ghi thiết kế được tạo từ tab chạy thử.
