# 🏴‍☠️ Hải Tặc Phục Sinh

Game nhập vai đánh theo lượt chạy trên trình duyệt, dựng lại giao diện, font, sprite và hoạt ảnh Spine từ bản mobile gốc.
Máy chủ viết bằng **Node.js + Express**, dữ liệu người chơi lưu trên **MongoDB**.

<p align="center">
  <img src="docs/images/home.jpg" alt="Màn hình chính" width="80%">
</p>

| Đăng nhập | Thông tin tướng |
| :---: | :---: |
| ![Màn đăng nhập](docs/images/login.jpg) | ![Thông tin tướng Luffy Gear 2](docs/images/heroes.jpg) |
| **Phụ bản** | **Chiến đấu theo lượt** |
| ![Bản đồ phụ bản](docs/images/campaign.jpg) | ![Trận đấu ải 1-1](docs/images/battle.jpg) |
| **Tuyệt kỹ** | **Chiến thắng** |
| ![Tuyệt kỹ của Zoro King Of Hell](docs/images/skill.jpg) | ![Bảng thưởng sau trận](docs/images/victory.jpg) |

---

## Mục lục

- [Yêu cầu](#yêu-cầu)
- [Cài đặt nhanh](#cài-đặt-nhanh)
- [Cấu hình `.env`](#cấu-hình-env)
- [Lỗi thường gặp](#lỗi-thường-gặp)
- [Deploy lên Vercel](#deploy-lên-vercel)
- [Kiểm thử](#kiểm-thử)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Tài liệu chi tiết](#tài-liệu-chi-tiết)

## Yêu cầu

| Phần mềm | Phiên bản | Ghi chú |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | **22 trở lên** | Kiểm tra bằng `node -v` |
| [Git](https://git-scm.com/) | bất kỳ | Để clone repo |
| MongoDB | Atlas (miễn phí) hoặc cài trên máy | Cần một connection string `mongodb+srv://...` hoặc `mongodb://...` |
| Chrome | tùy chọn | Chỉ cần khi chạy test giao diện (`npm run test:ui`) |
| Python 3 | tùy chọn | Chỉ cần khi muốn tái xuất asset từ APK (`tools/export-*.py`) |

## Cài đặt nhanh

**1. Clone repo và cài thư viện**

```bash
git clone <địa-chỉ-repo>
cd HTHT
npm install
```

> ⚠️ Thư mục `node_modules` không được đưa lên Git. Mỗi lần clone sang máy mới đều **phải chạy `npm install`**,
> nếu không sẽ gặp lỗi `Cannot find package 'mongodb'`.

**2. Tạo file `.env`**

```bash
cp .env.example .env
```

Trên Windows PowerShell dùng `Copy-Item .env.example .env`. Sau đó mở `.env` và điền `MONGODB_URI` (xem [Cấu hình `.env`](#cấu-hình-env)).

**3. Chạy game**

```bash
npm start
```

Mở trình duyệt tại **<http://127.0.0.1:4173/>**, bấm **Đăng ký** để tạo tài khoản rồi vào chơi.
Không có tài khoản hoặc mật khẩu mặc định.

Trang quản trị nằm ở **<http://127.0.0.1:4173/admin>** và dùng mật khẩu `ADMIN_PASSWORD` trong `.env`.

## Cấu hình `.env`

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
| --- | :---: | --- | --- |
| `MONGODB_URI` | ✅ | — | Connection string MongoDB, ví dụ `mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/` |
| `MONGODB_DB` | | `haitacphucsinh_local` | Tên database dùng cho game |
| `HOST` | | `127.0.0.1` | Địa chỉ server lắng nghe. Đặt `0.0.0.0` để máy khác trong mạng LAN truy cập |
| `PORT` | | `4173` | Cổng HTTP |
| `ADMIN_PASSWORD` | | — | Mật khẩu trang `/admin`, **ít nhất 12 ký tự**. Để trống hoặc ngắn hơn thì trang admin bị tắt |
| `NODE_ENV` | | — | `development` khi chạy máy, `production` khi deploy |
| `NEW_ACCOUNT_INTRO` | | bật | Đặt `off` để tài khoản mới bỏ qua phần mở đầu và nhận sẵn Luffy |
| `TTH_START_DATE` | | `2026-11-01` | Ngày bắt đầu sự kiện Tân Tứ Hoàng |

**Lấy `MONGODB_URI` từ MongoDB Atlas:**

1. Tạo cluster miễn phí tại <https://cloud.mongodb.com/>.
2. **Database Access** → tạo user và mật khẩu.
3. **Network Access** → **Add IP Address** → thêm IP máy bạn (hoặc `0.0.0.0/0` khi thử nghiệm).
4. **Connect** → **Drivers** → sao chép chuỗi kết nối, thay `<password>` bằng mật khẩu thật rồi dán vào `.env`.

> 🔒 Không commit file `.env` (đã có trong `.gitignore`) và không ghi mật khẩu thật vào `.env.example`.

## Lỗi thường gặp

| Thông báo lỗi | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| `Cannot find package 'mongodb'` (hoặc `express`, `helmet`) | Chưa cài thư viện | Chạy `npm install` |
| `Thiếu MONGODB_URI` | Chưa có file `.env` hoặc chưa điền biến | Làm lại bước 2 ở trên |
| `bad auth : Authentication failed` | Sai user hoặc mật khẩu trong `MONGODB_URI` | Kiểm tra lại ở Atlas → **Database Access**. Mật khẩu có ký tự đặc biệt (`@ : / ?`…) phải được mã hóa URL |
| `Không kết nối được MongoDB: AtlasError` / timeout | IP máy chưa được phép kết nối | Atlas → **Network Access** → thêm IP hiện tại |
| `Cổng đang được sử dụng` | Cổng 4173 đã bị chiếm | Tắt chương trình đang dùng cổng hoặc đổi `PORT` trong `.env` |
| `npm warn EBADENGINE` | Node.js cũ hơn 22 | Cài Node.js 22 LTS trở lên |

## Deploy lên Vercel

Dự án đã có sẵn Vercel Function trong `index.mjs` và `vercel.json`.

1. Import repo vào Vercel. **Root Directory** là thư mục chứa `index.mjs` và `package.json`.
2. Để **Build Command** trống (hoặc chọn *Override* và nhập `None`). **Không** đặt là `npm start`.
3. Thêm Environment Variables:

   ```text
   MONGODB_URI=mongodb+srv://...
   MONGODB_DB=haitacphucsinh_local
   ADMIN_PASSWORD=...
   NODE_ENV=production
   ```

4. Trong Atlas → **Network Access**, cho phép Vercel kết nối (thường là `0.0.0.0/0`).
5. Deploy xong, mở `https://<tên-dự-án>.vercel.app/api/health` để kiểm tra.

Nếu đặt sau một reverse proxy khác, proxy cần chuyển tiếp header `X-Forwarded-Proto` và `X-Forwarded-Host` để cookie phiên và kiểm tra `Origin` hoạt động đúng.

## Kiểm thử

```bash
npm run check             # kiểm tra cú pháp và dữ liệu
npm test                  # unit test (không cần MongoDB)
npm run test:integration  # HTTP + MongoDB thật, đọc .env
npm run test:ui           # chạy Chrome headless, ảnh lưu ở qa-output/
```

- Integration test và UI test tự tạo database riêng (`htps_test_*`, `htps_ui_*`) rồi tự xóa sau khi chạy. **Không** trỏ chúng vào database có tài khoản thật.
- Các script `node tools/qa-*.cjs` dùng Chrome ở `C:/Program Files/Google/Chrome/Application/chrome.exe`. Máy khác cần sửa đường dẫn này.

## Cấu trúc thư mục

```text
HTHT/
├── server/          # Máy chủ: route, đăng nhập, luật game, lưu MongoDB
│   ├── index.mjs    #   điểm khởi động (npm start)
│   ├── app.mjs      #   route Express, auth, CSRF
│   ├── store.mjs    #   lưu dữ liệu MongoDB
│   └── game.mjs     #   luật nâng tướng, túi đồ, chiến đấu
├── dist/            # Giao diện web (HTML/JS/CSS, asset, dữ liệu JSON)
├── api/, index.mjs  # Vercel Function
├── test/            # Unit test và integration test (node --test)
├── tools/           # Script QA (qa-*.cjs) và tái xuất asset (export-*.py)
└── docs/            # Tài liệu chi tiết và ảnh demo
```

## Tài liệu chi tiết

- [docs/FEATURES.md](docs/FEATURES.md): luồng chơi, các tính năng đã tích hợp và bảng mô tả từng module
- [docs/GAME-FLOWS.md](docs/GAME-FLOWS.md): schema, API, chi phí và xử lý giao dịch
- [docs/CAMPAIGN.md](docs/CAMPAIGN.md): dữ liệu Phụ bản và đội hình
- [docs/ZORO-KING-OF-HELL.md](docs/ZORO-KING-OF-HELL.md): asset và luật của Zoro

---

Runtime Spine trong `dist/vendor/spine-canvas.js` thuộc [EsotericSoftware/spine-runtimes 3.8](https://github.com/EsotericSoftware/spine-runtimes/tree/3.8/spine-ts) và giữ nguyên thông báo bản quyền.
Đây là dự án thử nghiệm phi thương mại. Asset gốc thuộc về chủ sở hữu tương ứng.
