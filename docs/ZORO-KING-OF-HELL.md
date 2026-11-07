# Zoro King Of Hell — nguồn cache HTTH

Đã xác nhận đây là **avatar 576**, tên trong `database_ex`: **Zoro King Of Hell**; hệ `light` (Minh mẫn), lớp `mage` (Chỉ Huy). Ảnh art và bộ 4 icon khớp ảnh tham chiếu. Không dùng asset Zoro thường hay Zoro Wano.

Nguồn cache cục bộ: `E:\New folder\HaiTacDaiChien_v1.1.3\HTTH\com.vn.haitacdaichien\files\UnityCache\Shared`.

| Gói cache | Tài nguyên |
| --- | --- |
| `heroart_ex`, `herohead_ex`, `herothumb_ex` | Art, avatar và thẻ 576 |
| `skillicon_ex` | 588, 589, 590, 591 |
| `herospineupdate` | Toàn bộ 18 resource trong `heroes/576/`: Hero, Cuts và Skill; mỗi bộ có texture, atlas, skeleton, material và hai descriptor Unity |
| `database_ex` | Ba hàng tướng 576/577/578, kỹ năng ba cấp và cấu hình phát chiêu |

Tái xuất, không sửa cache đầu vào:

```powershell
python tools/export-zoro-cache.py 'E:\New folder\HaiTacDaiChien_v1.1.3\HTTH'
```

Ảnh được lưu thành PNG và WebP lossless trong `dist/game-assets/zoro-king-of-hell/`. Atlas và skeleton giữ dữ liệu gốc; `source-metadata.json` giữ các descriptor/material Unity. `dist/zoro-king-of-hell.json` liên kết toàn bộ file với dữ liệu tướng và mô tả kỹ năng.

| Kỹ năng | Icon | ID nguồn cấp 1 / 2 / 3 |
| --- | --- | --- |
| Ippyakusanjo Hiryu Jigoku | 588 | 2581 / 2577 / 2573 |
| Địa Ngục Kiếm Enma | 589 | 2582 / 2578 / 2574 |
| Haki Bá Vương | 590 | 2583 / 2579 / 2575 |
| Đòn Quyết Định | 591 | 2584 / 2580 / 2576 |

Trong bản thử nghiệm, tài khoản mới và cũ có thêm Zoro cấp 1 với bốn kỹ năng cấp 3 theo ảnh. Chọn thẻ tướng sẽ chuyển tướng dùng ở trang chủ và trong trận. Mỗi tướng giữ riêng cấp, EXP, sao, bậc, trang bị và kỹ năng; vàng, vật phẩm và tiến trình thám hiểm dùng chung. Không đổi tướng khi trận đang chạy. Không ghi đè tiến trình Luffy hoặc cấp thêm tiền khi chuyển tướng.

Chỉ số tăng cấp vẫn dùng nền kinh tế thử nghiệm hiện tại, không sao chép chỉ số Lv250 trong ảnh. Enma tăng công/tốc độ theo cấp kỹ năng. Trận Zoro khởi đầu 100 nộ để thử được chiêu ngay: 50 nộ cơ bản và 50 từ Enma. Nộ tiêu hao 100; đòn thường đánh địch có HP tuyệt đối thấp nhất. Chiêu tăng công trước khi đánh, có sát thương theo máu đã mất, ngưỡng Trảm Sát và một lần dùng chiêu bổ sung mỗi lượt. Haki áp dụng trong các lượt đầu, vị trí tướng đơn được tính là hàng trước. Giảm sát thương trực tiếp của Enma áp dụng với đòn được đánh dấu `directDamage`; kháng sát thương/bất tử/né tránh có cờ riêng. NPC mẫu hiện không có các trạng thái này. Chưa phát âm thanh.

Spine 3.8.82 đọc được bằng runtime hiện tại. File gốc: `Hero_576` idle 5,826 giây, đánh thường 3,1 giây, chiêu 14,167 giây; `Cuts_576` dài 12,175 giây. Theo yêu cầu đối chiếu với game, nộ dùng cinematic rồi tới nhát chém `beat` (bảng `db_battle_heroes` ghi `beat` là đòn thường, nhưng animation này có lớp tối toàn màn và nhát chém lớn); đòn thường đổi sang lao tới chém nhanh bằng `run`. Trên web, cinematic phát nhanh 4 lần, `beat` và hiệu ứng `skill_576` nhanh 2 lần rồi nhân tiếp với tốc độ trận ×1/×2. Sát thương rơi đúng khung mạnh nhất của `beat` (giây 2,6) và frame 0,5 của `skill_576`. Tổng thời gian từ bắt đầu chiêu tới trúng đòn khoảng 3,2 giây ở ×1 và 1,6 giây ở ×2.

Animation, chuyển vị trí, hiệu ứng và sự kiện sát thương dùng chung đồng hồ trận. Mỗi mốc sát thương được giữ ít nhất một frame khi máy chậm, tránh việc số sát thương chạy trước hình. Theo `db_battle_heroes`, hiệu ứng không bám mục tiêu: `Cuts_576` đặt tại tâm camera, `skill_576` đặt tại (2,5; -1,7) đơn vị camera. Web quy đổi vị trí đó theo tâm đội địch của bố cục web (`zoroStage` trong `dist/game.js`); số sát thương vẫn hiện trên mục tiêu. Chiêu Zoro không chồng thêm MagicHit trắng. Mỗi lần chuyển động tác đặt lại pose để xóa sprite trúng đòn trước khi chết; nhân vật chết mờ dần rồi biến mất.

Các attachment cắt hình, loại bỏ phần tử trong suốt/ngoài khung cắt và tam giác suy biến được xử lý trong `spine-clipping.js`; không sửa skeleton gốc.

Kiểm tra: `node --test test/zoro.test.mjs`, `node tools/qa-zoro.cjs`, `node tools/qa-zoro-timing.cjs`. Kiểm tra nhịp đo ×1/×2, CPU chậm 4 lần, vị trí va chạm, kích thước và sprite chết. QA trình duyệt dùng database `htps_zoro_*` riêng và xóa sau khi chạy; ảnh ở `qa-output/zoro/` và `qa-output/zoro-timing/`.
