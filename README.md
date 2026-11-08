# Hải Tặc Phục Sinh — Node.js + MongoDB

Bản game thử nghiệm dùng giao diện, font, sprite và Spine trích từ APK và cache HTTH. Chạy **Node.js 22+**, Express và MongoDB Atlas. Có **Luffy Gear 2** và **Zoro King Of Hell**; mỗi tướng giữ riêng tiến trình và trang bị.

## Chạy trên máy

```powershell
cd 'E:\New folder\HaiTacDaiChien_v1.1.3\web-ui'
npm install
npm start
```

Mở **http://127.0.0.1:4173/**. Tạo tài khoản ở màn đăng ký; không có tài khoản hoặc mật khẩu mặc định. Thông tin MongoDB của môi trường hiện tại đã được cấu hình trong `.env` cục bộ, được Git bỏ qua. Không đưa file này vào `dist/` hay chia sẻ nó.

Máy khác: sao chép `.env.example` thành `.env`, điền `MONGODB_URI`. Database mặc định `haitacphucsinh_local`; không sửa database khác trong cluster. MongoDB Atlas cần cho phép IP của máy chạy Node.js. Chạy `npm run dev` để Node tự khởi động lại khi mã server thay đổi.

## Deploy lên Vercel

Dự án đã có Vercel Function tại `api/index.mjs`; không dùng `npm start` để chạy server lâu dài trên Vercel. Import repository vào Vercel, giữ **Root Directory** là `web-ui` nếu repository chứa thư mục cha, sau đó khai báo các Environment Variables:

```text
MONGODB_URI=mongodb+srv://...
MONGODB_DB=haitacphucsinh_local
ADMIN_PASSWORD=...
NODE_ENV=production
```

Trong Vercel, để **Build Command** trống (hoặc chọn `Override` và nhập `None`), không đặt là `npm start` hay `npm run dev`. `MONGODB_URI` phải là toàn bộ URI thật, ví dụ bắt đầu bằng `mongodb+srv://`, không nhập giá trị đã che/mã hóa. Nếu đã đặt Build Command trong Project Settings, thiết lập đó có thể ghi đè `vercel.json`.

Trong MongoDB Atlas, cho phép kết nối từ Vercel (Network Access). Sau khi deploy, mở URL Vercel và kiểm tra `/api/health`. File `.env` chỉ dùng local và không được upload lên Vercel.


## Luồng chơi

1. **Đăng ký** tên 3–24 ký tự ASCII, số, `_`; mật khẩu 8–128 ký tự. Đăng ký thành công tự đăng nhập.
2. Nhận Luffy Gear 2 và Zoro King Of Hell cấp 1, **12.000 vàng**, **500 kim cương**, kinh nghiệm và nguyên liệu khởi đầu; có một món mỗi ô trang bị. Tài khoản cũ cũng có Zoro; chọn thẻ tướng để chuyển nhân vật đang dùng. Zoro có sẵn bốn kỹ năng cấp 3 theo ảnh tham chiếu.
3. **Tướng → Thuộc tính**: nâng cấp; **Thức tỉnh**: nâng sao; **Đột phá**: nâng bậc. **Trang bị**: chọn đồ, trang bị nhanh hoặc gỡ toàn bộ. **Trang bị đặc thù**: mở khi tướng cấp 30; món *Vai trò* (Công, Huy Hiệu theo nghề) và *Nhóm hạng* (Máu, Huy Hiệu Rank S/SS, chỉ tướng hạng S trở lên). Bấm huy hiệu để mở popup gốc: **Cường hóa** nâng cấp độ (tối đa bằng cấp tướng, tốn vàng + Đá nâng đồ, từ cấp 250 thêm Đá Năng Lượng), **Phẩm đồ** nâng 15 sao (cần cấp độ 20×phẩm, tốn Huy Hiệu + Sách Hệ + Đá nâng đồ + vàng). Số liệu chi phí/chỉ số là số tự đặt vì bảng gốc do server gửi. **Kỹ năng**: Roi Cao Su, Mài Dũa, Haki Vũ Trang và Tuyệt Cảnh, dùng đúng 4 icon gốc và thông số ba cấp trong APK.
4. **Túi đồ**: xem đồ sở hữu, dùng đồ có hiệu ứng, trang bị, bán. **Từ điển vật phẩm** xem toàn bộ catalog. **Cửa hàng** mua theo giá server.
5. **Phụ bản** trên màn hình chính: chọn đảo/ải → Vượt ải → xếp tối đa sáu tướng ở hàng trước/sau, có thể dùng cả Luffy và Zoro → Chiến đấu. Kéo thẻ để đổi chỗ, chạm thẻ đã chọn trong danh sách để gỡ. Có 999 ải trong 95 chương từ dữ liệu gốc và 119 mẫu đối thủ. Bản đồ đảo, boong tàu, thanh ải và bảng đội hình dùng asset gốc.
6. Vào trận tự chiến đấu theo lượt: Luffy đánh thường để tích nộ, tự dùng Roi Cao Su khi đủ 80 nộ và hết hồi chiêu. Zoro tự dùng Ippyakusanjo Hiryu Jigoku khi đủ 100 nộ, dùng cảnh thi triển và hiệu ứng chém gốc từ cache. Nút ⓘ xem kỹ năng, tạm dừng sau lượt hiện tại hoặc tiếp tục. Có đổi tốc độ ×1/×2 và bỏ qua hoạt ảnh đến kết quả. Tải lại trang tự tiếp tục trận còn dang dở. Chi tiết nguồn asset và luật Zoro: [ZORO-KING-OF-HELL.md](docs/ZORO-KING-OF-HELL.md).
7. Thắng trận tự lưu thưởng, EXP, loot và mở màn tiếp theo. Đóng bảng thưởng không ảnh hưởng việc nhận thưởng. Rút lui/thua không nhận thưởng. Sau khi qua ải, rương trên boong tích vàng, kinh nghiệm và Đá EXP theo ải cao nhất, đầy sau 10 tiếng; bấm rương để nhận.
8. **Điểm danh** nhận quà mỗi ngày, làm mới 00:00 UTC+7. **Đăng xuất** thu hồi phiên trên server; đăng nhập lại khôi phục toàn bộ tiến trình. Đang có trận chưa xong thì đăng nhập lại tiếp tục trận đó.
9. Chạm avatar mở **Thông tin** để sửa tên hiển thị và đăng xuất. Tên đăng nhập được giữ nguyên. **Hòm thư** hiển thị quà điểm danh thực tế, nhận một lần qua server; xóa/ẩn thư và tùy chọn âm thanh lưu trong trình duyệt. Máy chủ hiện tại là máy chủ cục bộ.

Chi tiết schema, API, chi phí và xử lý giao dịch ở [docs/GAME-FLOWS.md](docs/GAME-FLOWS.md).

## Những gì đã tích hợp

- Đăng ký/đăng nhập/đăng xuất, cookie phiên HttpOnly, mật khẩu scrypt có salt, CSRF, kiểm tra Origin và giới hạn tần suất.
- Vàng, kim cương, level/EXP thuyền trưởng; level/EXP tướng; 6 sao, 5 bậc đột phá; cấp kỹ năng và 5 ô đồ `pants/armor/boots/helmet/accessory`.
- Catalog gốc: **325 vật phẩm** gồm 100 trang bị, 77 vật phẩm, 111 bảo vật, 37 mảnh; thêm 5 vật phẩm tiếp tế cho luồng prototype. Có 291 icon kỹ năng và tổng cộng 2.201 ảnh được đưa vào web.
- Mọi trang bị/bảo vật trong catalog đều có thể sở hữu, mặc/tháo và ảnh hưởng thuộc tính. Vật phẩm có hiệu ứng được dùng từ túi; nguyên liệu của các hệ thống khác được giữ trong từ điển và có thể bán. Chưa có logic chiến hạm, quay số hay triệu hồi thêm tướng.
- Luffy dùng đúng asset 109: `idling` loop liên tục ở trang chủ; `beat`, `skill3`, `damage`, `dead`, `win` khi chiến đấu. Các NPC dùng asset sẵn có, không thêm tướng vào đội hình người chơi.
- Màn hình chính hiển thị toàn bộ tướng trong đội hình đã lưu (tối đa sáu), căn giữa theo số tướng, có tên/cấp/hệ riêng và idle lặp liên tục. Chạm nhân vật mở đúng thông tin tướng đó.
- Hiệu ứng chiến đấu dùng Spine `MagicHit_1` và nắm đấm/luồng hơi nằm trong animation Luffy gốc. Thời điểm va chạm lấy từ `db_battle_heroes`: Luffy 0,36 giây, tuyệt kỹ 0,73 giây, lính 0,26 giây. Tuyệt kỹ phát trọn animation; hiệu ứng chạy theo tốc độ trận và được dọn khi bỏ qua/rời trận. Tái xuất bằng `python tools/export-battle-reference.py`.
- Bộ kỹ năng dùng icon `685/140/183/160`. Cấp 3: Roi Cao Su đánh một địch 320% Công, hồi đồng minh ít máu nhất 560% Công và tăng Công 60% cho hai lượt đánh tiếp theo; Mài Dũa giảm 18 điểm phần trăm chí mạng của kẻ vừa đánh trong ba lượt tiếp theo; Haki tăng 40% Giáp/Máu; Tuyệt Cảnh tăng 120% Giáp trong ba lượt tính cả lượt kích hoạt, chỉ kích hoạt một lần khi còn sống và máu dưới 30%. Roi Cao Su chọn đồng minh còn sống có tỷ lệ HP thấp nhất, kể cả chính Luffy; không hồi sinh tướng đã bị hạ. Hồi máu dùng hiệu ứng gốc `Buff_mau`; địch thử nghiệm có 20% chí mạng cơ bản, sát thương chí mạng ×1,5. Các hiệu ứng cùng loại làm mới thời hạn, không cộng dồn.
- Tiến trình kỹ năng cũ được đối chiếu tự động: `jet-gatling → rubber-whip`, `jet-pistol → polish`, `gear-second → armament-haki`; Tuyệt Cảnh bắt đầu cấp 1. Giữ các khóa/cấp cũ trong database, không trừ thêm tài nguyên. Kỹ năng hiện tại có ba mốc hiệu lực gốc; cấp cũ cao hơn 3 vẫn được giữ và dùng hiệu lực cấp 3.
- Màn Tướng bám theo ảnh tham chiếu: sáu bộ lọc hệ, thẻ dọc có cấp/tên/phẩm/sao; chi tiết có bảng thuộc tính, chi phí và nút nâng cấp thường/x10, kỹ năng tròn, các tab bên phải. Chỉ hiển thị tướng thực sự sở hữu. Nút x10 nâng tối đa 10 cấp và tự dừng khi hết kinh nghiệm, vàng hoặc chạm trần cấp.
- Khung game mở rộng tối đa 1600 CSS pixel theo chiều ngang, giữ tỷ lệ 1136:640 và tự thu nhỏ khi cần. Canvas vẽ trực tiếp theo kích thước hiển thị × mật độ điểm ảnh (tối đa DPR 3), cập nhật khi resize/đổi màn hình; tọa độ bấm vẫn dùng không gian thiết kế 1136×640. Trên màn hình DPR 2, khung 1600 px dùng canvas rộng 3200 pixel thay vì kéo giãn bitmap 1136 pixel. Mức chi tiết của texture vẫn phụ thuộc độ phân giải tài nguyên gốc.
- Tính sát thương và thưởng ở server; không tin damage, balance hoặc rewards do client gửi. Cập nhật tài khoản/vàng/đồ/chiến đấu cùng một document có version để chống mất cập nhật. Mã thao tác chống gửi lặp; lịch sử 150 thao tác gần nhất, phần thưởng trận có trạng thái kết thúc riêng.

## So với video mẫu

Tham chiếu [video gameplay](https://www.youtube.com/watch?v=4h6vNbxS-9Y): đội hình đứng hai phía, thanh máu/nộ, lượt đánh, di chuyển áp sát, nhận đòn, cut-in tuyệt kỹ và bảng thưởng. Khung hình tham chiếu được lưu cục bộ trong `extracted/reference/`.

Engine hỗ trợ tối đa 6 đấu 6, lượt theo tốc độ và trạng thái riêng từng nhân vật. Hiện người chơi có hai tướng hoàn chỉnh Luffy Gear 2 và Zoro King Of Hell; NPC vẫn dùng đòn đánh thường, chưa có mọi bộ kỹ năng hoặc nội dung của video. Balance/giá là cấu hình thử nghiệm; dữ liệu phụ bản và thưởng lấy từ cache gốc. Các scene/prefab còn lại vẫn được giữ để bổ sung dần.

## Kiểm tra

```powershell
npm run check
npm test
npm run test:integration
npm run test:ui
node tools/qa-battle.cjs
node tools/qa-reference-ui.cjs
node tools/qa-resolution.cjs
node tools/qa-luffy-skills.cjs
node tools/qa-team.cjs
```

- Unit test: chi phí, trang bị, vật phẩm, điểm danh, battle, điều kiện mở màn, thưởng một lần.
- Integration: HTTP thật + MongoDB thật, tài khoản/phiên, yêu cầu đồng thời, chống lặp, restore tiến trình. Tạo database `htps_test_*` riêng và tự xóa đúng database đó sau kiểm tra.
- UI: Chrome headless với database `htps_ui_*` riêng; kiểm tra các luồng chơi rồi tự dọn dữ liệu. Ảnh và report trong `qa-output/game/`. Script cấu hình đường dẫn Chrome Windows; chỉnh nếu chạy trên máy khác.

Không chạy test ghi dữ liệu trong database tài khoản thật. `npm test` bỏ qua integration khi không có biến môi trường MongoDB; `test:integration` và `test:ui` đọc `.env`.

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `server/index.mjs` | Khởi động HTTP + MongoDB |
| `server/app.mjs` | Route, validation, auth, cookie, CSRF |
| `server/store.mjs` | Persistence, phiên, optimistic concurrency, receipts |
| `server/game.mjs` | Luật nâng tướng, inventory, battle, loot |
| `server/formation.mjs` / `team-combat.mjs` | Đội hình sáu ô, thứ tự lượt, HP/nộ/kỹ năng từng tướng |
| `server/catalog.mjs` | Hero, 12 màn, chi phí, vật phẩm, cấu hình economy |
| `dist/app.js` | Bộ dựng scene/Spine Unity |
| `dist/game.js` / `game.css` | Giao diện chơi, API client, phát animation trận |
| `dist/hero.css` | Bố cục và kiểu hiển thị hai màn Tướng theo ảnh tham chiếu |
| `dist/reference-ui.js` / `reference-ui.css` | Thông tin, Hòm thư, Túi đồ, Trang bị, Thức tỉnh, Trang bị đặc thù và popup nâng cấp (prefab PanelSpecialEquip / PopupSpecialEquipUpgrade) |
| `tools/export-attack-effects.cjs` | Thêm hiệu ứng đòn đánh thường gốc (skill `beat` trong `db_battle_heroes`) vào `hero-effects.json`; đọc cache HTTH bằng `tools/unityfs.cjs`, không cần Python |
| `tools/qa-attack-effects.cjs` | QA: vào ải 20, xác nhận hiệu ứng đòn thường gốc (Hit_189, MagicHit_1…) chạy trong trận |
| `server/daily-quests.mjs` | Nhiệm vụ hằng ngày (PopupDailyQuest): 10 nhiệm vụ gốc, làm mới 0h giờ Việt Nam, thưởng từng nhiệm vụ (20.000×n vàng, 500×n EXP tướng) và thưởng hoàn thành 10/10 (100 kim cương, 15 Bụi ma thuật) |
| `tools/qa-daily-quests.cjs` | QA: mở Nhiệm vụ từ sảnh, chiêu mộ, nhận thưởng |
| `server/special-equip.mjs` | Logic Trang bị đặc thù: mở khóa, Cường hóa, Phẩm đồ, cộng chỉ số |
| `tools/qa-reference-ui.cjs` | Kiểm tra bố cục, sửa tên, nhận quà, trang bị và thức tỉnh với database `htps_reference_*` riêng |
| `tools/qa-resolution.cjs` | Kiểm tra giới hạn khung 4K, canvas DPR 1/2/3, đổi mật độ điểm ảnh, tọa độ bấm, điện thoại và Spine; dùng database `htps_resolution_*` riêng |
| `dist/battle.css` / `battle-reference.json` | HUD chiến đấu theo ảnh mẫu và bộ xương lính áo tím gốc |
| `dist/luffy-skills.json` / `server/luffy-skills.mjs` | Bộ 4 kỹ năng, nguồn icon/mô tả gốc, đối chiếu cấp cũ và chỉ số hiệu ứng |
| `tools/export-luffy-skills.py` / `tools/qa-luffy-skills.cjs` | Tái xuất kỹ năng từ APK và kiểm tra nâng cấp, tooltip, hồi máu, buff trong trình duyệt |
| `dist/game-catalog.json` / `game-visuals.json` | Catalog và tham chiếu asset gốc |
| `tools/research-game-assets.py` | Tái xuất asset gameplay theo namespace Unity Resources |
| `tools/qa-heroes.cjs` | Kiểm tra bộ lọc, bố cục, nâng cấp x10, kỹ năng, trang bị và điều hướng màn Tướng |
| `tools/qa-battle.cjs` | Kiểm tra HUD, tốc độ, bỏ qua giữa đòn đánh, thưởng một lần, đội hình, màn hình nhỏ và rút lui; dùng database `htps_battle_*` riêng |
| `extracted/original-assets/` | 4.215 texture PNG, 14 font, 1.224 TextAsset gốc, chỉ cục bộ |

Runtime Spine giữ thông báo bản quyền trong `dist/vendor/spine-canvas.js`, từ [EsotericSoftware/spine-runtimes 3.8](https://github.com/EsotericSoftware/spine-runtimes/tree/3.8/spine-ts). Bộ nạp chuẩn hóa marker JSON legacy và đường dẫn attachment có khoảng trắng; không sửa file APK gốc.

Nguồn dữ liệu Phụ bản, luồng đội hình và quy tắc chuyển tiếp tiến trình: [CAMPAIGN.md](docs/CAMPAIGN.md). Luật rương tự động đánh ải: [GAME-FLOWS.md](docs/GAME-FLOWS.md). Kiểm tra rương: `node --test test/afk.test.mjs`, `node tools/qa-afk.cjs`. Kiểm tra Leo đậu thần: `node --test test/tower.test.mjs`, `node tools/qa-tower.cjs`. Kiểm tra chiêu mộ và tướng ra trận: `node --test test/summon.test.mjs test/summoned-heroes.test.mjs`, `node tools/qa-summon.cjs`, `node tools/qa-summoned-battle.cjs`. Tái xuất bằng `python tools/export-campaign.py`; kiểm tra trình duyệt bằng `node tools/qa-campaign.cjs`.
