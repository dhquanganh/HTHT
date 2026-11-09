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

Dự án đã có Vercel Function tại `index.mjs`; không dùng `npm start` để chạy server lâu dài trên Vercel. Import repository vào Vercel, giữ **Root Directory** là thư mục chứa `index.mjs` và `package.json`, sau đó khai báo các Environment Variables:

```text
MONGODB_URI=mongodb+srv://...
MONGODB_DB=haitacphucsinh_local
ADMIN_PASSWORD=...
NODE_ENV=production
```

Trong Vercel, để **Build Command** trống (hoặc chọn `Override` và nhập `None`), không đặt là `npm start` hay `npm run dev`. `MONGODB_URI` phải là toàn bộ URI thật, ví dụ bắt đầu bằng `mongodb+srv://`, không nhập giá trị đã che/mã hóa. Nếu đã đặt Build Command trong Project Settings, thiết lập đó có thể ghi đè `vercel.json`.

Trong MongoDB Atlas, cho phép kết nối từ Vercel (Network Access). Sau khi deploy, mở URL Vercel và kiểm tra `/api/health`. File `.env` chỉ dùng local và không được upload lên Vercel.

Máy chủ nhận diện HTTPS qua proxy của Vercel để kiểm tra `Origin` và đặt cookie phiên đúng thuộc tính bảo mật. Nếu dùng reverse proxy khác, proxy đó cần truyền tiếp các header `X-Forwarded-Proto` và `X-Forwarded-Host`.


## Luồng chơi

1. **Đăng ký** tên 3–24 ký tự ASCII, số, `_`; mật khẩu 8–128 ký tự. Đăng ký thành công tự đăng nhập.
2. Nhận Luffy Gear 2 và Zoro King Of Hell cấp 1, **12.000 vàng**, **500 kim cương**, kinh nghiệm và nguyên liệu khởi đầu; có một món mỗi ô trang bị. Tài khoản cũ cũng có Zoro; chọn thẻ tướng để chuyển nhân vật đang dùng. Zoro có sẵn bốn kỹ năng cấp 3 theo ảnh tham chiếu.
3. **Tướng → Thuộc tính**: nâng cấp; **Thức tỉnh**: nâng sao; **Đột phá**: nâng bậc. **Trang bị**: chọn đồ, trang bị nhanh hoặc gỡ toàn bộ. **Trang bị đặc thù**: mở khi tướng cấp 30; món *Vai trò* (Công, Huy Hiệu theo nghề) và *Nhóm hạng* (Máu, Huy Hiệu Rank S/SS, chỉ tướng hạng S trở lên). Bấm huy hiệu để mở popup gốc: **Cường hóa** nâng cấp độ (tối đa bằng cấp tướng, tốn vàng + Đá nâng đồ, từ cấp 250 thêm Đá Năng Lượng), **Phẩm đồ** nâng 15 sao (cần cấp độ 20×phẩm, tốn Huy Hiệu + Sách Hệ + Đá nâng đồ + vàng). Số liệu chi phí/chỉ số là số tự đặt vì bảng gốc do server gửi. Kỹ năng không còn nâng bằng sách mà tự lên cấp khi thức tỉnh, giống bản gốc (mỗi mức sao trong `db_heroes` dùng một bản kỹ năng `[n]`), mọi tướng như nhau: 1–2 sao cấp 1, 3–4 sao cấp 2, 5 sao cấp 3, **sao tím (6 sao) max cấp 4**. Mô tả và hiệu ứng trận đấu từng cấp lấy từ bản `[1]`–`[4]` gốc (`dist/skill-levels.json`, `python tools/export-skill-levels.py`; cấp 4 từ bản void). Zoro King Of Hell dùng bản `[4]` void gốc; Luffy Gear 2 không có `[4]` trong dữ liệu gốc nên cấp 4 tăng tiếp theo nhịp `[1]`–`[3]`. **Haki** (tab cuối, thay tab Kỹ năng cũ): dựng nguyên prefab gốc `PanelESkill` / `PopupHeroESkill` và 15 icon `skill_e_*`; 5 bậc mở lần lượt ở L1–L5 (sao 15–19), mỗi bậc chọn 1 trong 3 Haki (Quan Sát / Vũ Trang / Bá Vương), đổi miễn phí. Chỉ số % Máu/Công/Tốc cộng vào lực chiến; hiệu ứng còn lại (giảm ST chí mạng/DOT, hồi máu cuối lượt, miễn 3 lần ST khi dưới 50% máu, hồi 100 nộ...) chạy trong trận.
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
- Màn Thông tin tướng đặt đúng prefab `PanelHeroInfo` gốc: `BoxInfo` 490×558 tại (533,69), tab dọc tại x=1014, đủ cấp tối đa thì hiện hộp "Tối Đa"; nút Thiên phú ở góc trái.
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
| `server/talent.mjs` / `dist/talent-ui.js` / `dist/talent.json` | Thiên phú (HolyBlessing gốc, bundle `lua_holyblessing`): mở ở sao đỏ; chọn bảng Cuồng Bạo / Thủ Ngự / Viện Trợ (lần đầu miễn phí, đổi 500 KC), 50 cấp theo `db_talent_upgrade` (Kết Tinh Ý Chí; Công/Máu/Tốc), nâng sao ở cấp 10/20/30/40/50 (thêm Ngọc Tủy Hải Hồn và 10 mảnh mỗi bản sao tướng) để mở ô kỹ năng và tăng giới hạn cấp tướng, 5 ô × 3 kỹ năng `db_hero_skill` 210001-210045 vào trận dưới dạng bị động (hiệu ứng viết tay từng kỹ năng trong bảng `kits` của `talent.mjs`, không qua parser mô tả; engine `team-combat.mjs` hỗ trợ Kháng Chí Mạng, Bỏ Qua Né Tránh / Giới Hạn ST / Bất Tử, Miễn Chống, ST & Giảm ST đánh thường / Nộ / cuối lượt, Hiệu Quả Hồi Nộ, Bỏng Lạnh, Phong Ấn, Suy Yếu, Hộ Nguyên, buff Máu tối đa thật, bị động khi đánh thường cho cả Luffy / Zoro), cài lại 1000 KC hoàn nguyên liệu. Giao diện dựng nguyên prefab `HLB*` và Spine `anim_thienphu` (texture additive được nướng alpha theo độ sáng). Tái xuất: `python tools/export-talent.py`; QA: `node --test test/talent.test.mjs`, `node tools/qa-talent.cjs` |
| `server/exc.mjs` / `dist/exc-ui.js` / `dist/exc.json` | Luyện hồn (EXC gốc, bundle `lua_ex/_pack2/eventlua2/exclusive`). Dữ liệu nguyên `db_exc.json`: 39 tướng, 40 cấp, phí Hải hồn Sơ/Trung/Cao/Tuyệt (2201-2204), chỉ số tích lũy % Công / % Máu / Tốc (mã 100 / 102 / 3), kỹ năng 4 bậc mở ở cấp 10/20/30/40 (bậc cao thay bậc thấp, `stats` của bậc vào bộ kỹ năng trận đấu, phần kích hoạt đọc từ mô tả), cài lại tốn `fee_decay` kim cương và hoàn toàn bộ nguyên liệu. Mở khi tướng 10 sao (điều kiện máy chủ mở đủ 7 ngày bỏ qua vì bản web không có ngày mở server). Giao diện dựng nguyên prefab EXCButton (Spine Anim_thienphu Button/Button2 + Fire_eff Level0-4) và EXCPanelMain (sổ 2 trang, PopupHelp). Tái xuất: `python tools/export-exc.py`; QA: `node --test test/exc.test.mjs`, `node tools/qa-exc.cjs` |
| `server/arena.mjs` / `server/arena-store.mjs` / `dist/arena-ui.js` / `dist/arena.json` | Chiến trường (ArenaScene gốc, bấm tòa Chiến trường trên bản đồ thế giới). Dựng nguyên scene / prefab gốc bằng PrefabDOM: sảnh (8), Đơn đấu - Giải thách đấu (20), Liên đấu - Giải liên đấu (33), Võ đấu - Đấu trường Corrida (5), Đối thủ (1329), Chiến sử (1374), Phần thưởng (1333 / 1396 / 1014), Đội hình thủ (1112 / 1104), thông tin người chơi (1007), Vô song (1450 / 1434), cược (1051 / 1432). Bảng thưởng nguyên từ `db_arena_reward` / `db_allstars_*` (thưởng ngày 21:00 UTC, thưởng mùa khi mùa tuần kết thúc Chủ nhật 21:00 UTC, gửi qua Hòm thư). Đơn đấu cấp 14 / Liên đấu cấp 55 / Võ đấu cấp 80; Giấy Thách Đấu bổ sung đủ 10 mỗi ngày (mua thêm 20 KC); điểm khởi đầu 1000, thắng thua theo Elo (K=32) cho cả hai bên, chốt một lần mỗi trận; Liên đấu 3 đội đánh loạt 3 trận; Võ đấu vòng bảng đổi hạng + điểm mỗi giờ theo hạng, 16 hạng đầu vào Vô song (Vòng 1/16 → Chung Kết, loạt 3 trận), cược Chẵn/Lẻ bằng Lệnh bài võ đấu. Bảng được lấp bằng đối thủ máy (đội tướng thật theo hạng): cấp tướng 40 → 600 về phía top (top 10 có sàn cấp, hạng 1 cấp 600 sao L5), sao thấp nhất đủ trần cấp, Công / Máu / Thủ nhân hệ số ×1 → ×4,5 (hạng 1); mùa đang chạy được dựng lại theo `botVersion`, giữ điểm / hạng. Tái xuất: `python tools/export-arena.py`; QA: `node --test test/arena.test.mjs`, `node tools/qa-arena.cjs` |
| `server/guild.mjs` / `server/guild-store.mjs` / `dist/guild-ui.js` / `dist/guild.json` | Hạm đội (GuildScene gốc, đảo Hạm đội trên bản đồ thế giới). Dựng nguyên prefab gốc: Tìm đội / Lập đội (1078, 31 cờ 1377), GuildScene (11), Hội trường (1086, sửa thông tin 1456, quản lí 1317, duyệt đăng ký 1202, hoạt động 1067), Kỹ năng (1464), Đánh Boss (1122 / 1179 / 1126), Nhiệm vụ (1409). Boss lấy nguyên 60 ải `db_guild_boss_2` (đội quái, ô đứng, thưởng mỗi lượt / hạ boss / top 1-30) và quái `db_quai` → `db_heroes` (cấp, sao, cấp kỹ năng, hệ số Công/Máu/Giáp/Tốc gốc; chỉ số = đường tăng trưởng tướng bản web × hệ số gốc, máu ×10 vì boss chung). Boss dùng chung máu cả hạm đội, mỗi trận trừ máu đúng một lần (`guild_hits`), sát thương từng ải lưu ở `guild_boss_damage` (bảng xếp hạng xem được cả ải đã hạ, kèm người hạ boss và hạng thưởng đã chốt), hạ boss mở ải kế và gửi thưởng qua thư. Luật chữ gốc: tên 6-20 ký tự, lập đội 500 KC, kỹ năng sau cần kỹ năng trước cấp 10, lên Cấp độ cần max 8 kỹ năng + cấp hạm đội, thiết lập lại hoàn đủ (lần đầu miễn phí), lượt boss thêm 40 KC. Bảng kỹ năng / cấp hạm đội do máy chủ gốc gửi nên số do bản web đặt (3 Cấp độ × 8 kỹ năng × 20 cấp, phí 20000×cấp độ×(1+cấp/4) beli và 30×… huy hiệu; 3000×cấp EXP; 20+2/cấp thành viên). Kỹ năng chỉ cộng cho tướng cùng nghề khi đang trong hạm đội. Tái xuất: `python tools/export-guild.py`; QA: `node --test test/guild.test.mjs`, `node tools/qa-guild.cjs` |
| `server/tth.mjs` / `server/tth-store.mjs` / `dist/tth-ui.js` / `dist/tth.json` | Tân Tứ Hoàng (TTHMain gốc, bundle `lua_bossserver/eventlua2/tantuhoang`). Dựng nguyên prefab gốc: đảo B_TanTuHoang trên bản đồ thế giới (564,-116, chấm đỏ khi còn lượt), TTHHub (4 đảo, chibi Spine boss, Khiêu chiến chỉ ở boss hôm nay), TTHLobby (boss, Ngày · Cấp · Kháng, 4 kỹ năng gốc, XẾP HẠNG SÁT THƯƠNG có huy chương 1-3 và dòng của mình), TTHPopupReward / TTHRewardCell / TTHPopupChest. Luật gốc: 4 Tứ Hoàng xoay vòng theo ngày (TTHDb.BOSSES), boss mạnh lên mỗi ngày, không chết (đánh tới hết hiệp), 10 lượt miễn phí / ngày, mua thêm bằng kim cương, thưởng mốc sát thương 1 lần / mốc / ngày, xếp hạng theo sát thương cao nhất 1 lần trong ngày, thưởng gửi thư sau 00:00. Bảng xếp hạng lưu ở `tth_scores` (mỗi ngày / boss / người chơi một dòng, mỗi boss một bảng; xem được bảng boss khác), trả thưởng khóa bằng `tth_meta`. Số máy chủ gốc không có trong client nên do bản web đặt (`TTH_START_DATE` mặc định 2026-11-01, cấp = 10 × ngày, kháng, mốc = cấp × 50 × hệ số, thưởng hạng, giá mua 50 + 25 × lần mua). Tái xuất: `python tools/export-tth.py`; QA: `node --test test/tth.test.mjs`, `node tools/qa-tth.cjs` |
| `server/artifact-upgrade.mjs` / `dist/artifact-ui.js` / `dist/artifact-upgrade.json` | Nâng cấp bảo vật theo `db_artifact_upgrade_data` gốc (mỗi sao cần `upgrade_cost` EXP, nguyên liệu cho `base_value` + EXP đã nạp, tối đa 8 nguyên liệu, `max_star` sao); bảo vật đã nâng lưu bằng khóa `artifact:<id>@<sao>:<exp>`. Giao diện dựng từ prefab `PopupUpgradeArtifact`, ô `ItemArtifactUI` theo phẩm (`bgr_equipment_1..6`, `border_equipment_1..6`), bảo vật đỏ có lấp lánh `Item_effect`. Tái xuất: `python tools/export-artifact-upgrade.py`; QA: `node --test test/artifact-upgrade.test.mjs`, `node tools/qa-artifact-upgrade.cjs` |
| `server/haki.mjs` / `dist/haki-ui.js` / `dist/haki.json` | Bảng Haki: mở bậc, chọn Haki, chỉ số và trường hiệu ứng trận; giao diện dựng từ prefab gốc. Tái xuất: `python tools/export-haki.py`; QA: `node --test test/haki.test.mjs`, `node tools/qa-haki.cjs` |
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
