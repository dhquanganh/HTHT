# Hải Tặc Phục Sinh 1.1.8 — giao diện web

Bản xem giao diện được khôi phục từ dữ liệu Unity trong APK hiện tại. Không kết nối máy chủ game, không đăng nhập và không thực hiện giao dịch hay chiến đấu.

## Chạy trên máy

Mở PowerShell tại thư mục `web-ui`, chạy:

```powershell
python -m http.server 4173 --directory dist
```

Truy cập **http://localhost:4173/**. Có thể dùng `npm start` nếu đã cài Node.js. Không mở `dist/index.html` bằng `file://`, vì trình duyệt cần HTTP để tải JSON, font và atlas.

- Thanh dưới chọn màn hình và cửa sổ.
- Phím **H** ẩn/hiện thanh chọn; **← / →** chuyển màn hình.
- Nút trong game có thể chuyển sang màn liên quan; thẻ tướng mở giao diện chi tiết.
- Cuộn chuột để xem tiếp danh sách tướng, túi đồ và cửa hàng.
- Có thể dừng chuyển động hoặc bật toàn màn hình.

## Đã khôi phục

- 56 scene và 516 prefab được xuất thành JSON tại `dist/scenes/`. Các cửa sổ/bảng giao diện có trong thanh chọn; prefab phụ trợ vẫn được giữ trong thư mục.
- 1.601 ảnh WebP từ asset gốc được đưa vào bản web, cùng font và các file Spine cần dùng. Ảnh được chuyển sang WebP lossless.
- 922 mục bản địa hóa tiếng Việt từ các LanguageSource của game.
- Anchor, pivot, kích thước, tỷ lệ, thứ tự con, sprite có border, mask, text và phần lớn hình động Spine 3.8.
- Dữ liệu mẫu cho đội hình trang chủ, danh sách tướng, túi đồ, cửa hàng và chi tiết tướng. Dữ liệu này chỉ để xem bố cục, không phải dữ liệu tài khoản.

Tài nguyên đã tách riêng trong `extracted/original-assets/`:

| Loại | Số lượng | Định dạng |
| --- | ---: | --- |
| Texture2D có dữ liệu ảnh | 4.215 | PNG |
| Font | 14 | TTF |
| TextAsset | 1.224 | Nội dung gốc, gồm JSON/atlas/skeleton/bảng dữ liệu |

`manifest.json` ghi file nguồn, path ID, tên gốc và đường dẫn xuất. Có 14 texture kích thước 0 × 0 (chủ yếu atlas font được Unity tạo lúc chạy), không có dữ liệu ảnh lưu trong APK; chúng được ghi trong `skipped.json`. Lần xuất cuối không có lỗi.

## Phạm vi độ giống

Đây là bản khôi phục giao diện tĩnh từ asset và scene/prefab đã serialize, chưa phải bản đối chiếu pixel với game đang chạy. Một số scene chứa nội dung thử nghiệm/biến thể cũ. Các danh sách, popup, hiệu ứng, vật thể thế giới hoặc thành phần được Lua/C# tạo lúc chạy có thể còn thiếu hoặc giữ trạng thái mẫu. Các cửa sổ độc lập được đặt trên nền tối thay vì nền scene gọi chúng. Mask hiện dùng khung chữ nhật; shader/material đặc biệt và một số hiệu ứng màu chưa được mô phỏng đầy đủ.

Runtime Spine được giữ tại `dist/vendor/spine-canvas.js`, lấy từ [EsotericSoftware/spine-runtimes, nhánh 3.8](https://github.com/EsotericSoftware/spine-runtimes/tree/3.8/spine-ts). Giữ nguyên thông báo bản quyền trong file. Bộ nạp chuẩn hóa marker patch `3.8.75` cho reader 3.8 và trim các đường dẫn attachment có khoảng trắng khi atlas yêu cầu; file trích xuất gốc không bị thay đổi.

## Tái xuất tài nguyên

Cần Python 3.10+ và UnityPy:

```powershell
python -m pip install UnityPy
python tools/inspect_assets.py
python tools/extract_images.py
python tools/export_ui.py --prefabs
python tools/prepare_samples.py
```

Các script tự tìm thư mục `assets/bin/Data` ở thư mục APK cha. Chạy `prepare_samples.py` sau `export_ui.py` để bổ sung tài nguyên mẫu vào manifest cuối. Tất cả đầu ra nằm trong `web-ui`; không sửa file APK đầu vào. Thư mục `extracted/` chỉ lưu cục bộ và không được đưa lên website.

## Kiểm tra

- `npm run check`: kiểm tra cú pháp JavaScript.
- `node tools/validate.cjs`: kiểm tra JSON và đường dẫn tài nguyên.
- `node tools/qa.cjs`: xem trang chủ, đăng nhập, tướng bằng Chrome headless.
- `node tools/qa-scenes.cjs`: kiểm tra 40 màn/cửa sổ và kích thước điện thoại. Cần `npm install` và Chrome tại đường dẫn Windows khai báo trong script.

Ảnh chụp và kết quả kiểm tra nằm trong `qa-output/` (chỉ cục bộ).
