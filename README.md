# ⚙️ FU-DEVER Core Backend & API Gateway

<p align="center">
  <img src="public/images/logo.png" alt="FU-DEVER Logo" width="96" height="96" onerror="this.src='https://fudever.com/icons/layout/logo.png'" />
</p>

<p align="center">
  <b>Trung tâm dữ liệu, Xác thực & Cầu nối API chính thức của FU-DEVER</b><br />
  <i>Đại học FPT Đà Nẵng · "WORK HARD - PLAY HARD"</i>
</p>

<p align="center">
  <a href="https://dever-backend-production.up.railway.app/health"><img src="https://img.shields.io/badge/Production-Railway_Cloud-0B0D0E?style=for-the-badge&logo=railway&logoColor=white" alt="Railway Production" /></a>
  <a href="https://github.com/fudever-club/dever-backend"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
  <img src="https://img.shields.io/badge/Node.js-20_LTS-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4.19-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Atlas" />
  <img src="https://img.shields.io/badge/Cloudflare_R2-S3_Compatible-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare R2" />
  <img src="https://img.shields.io/badge/Telegram_Bot-@Fudever__bot-24A1DE?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram Bot" />
</p>

---

## 🌐 Tổng Quan Phân Hệ (Overview)

`dever-backend` là hạt nhân xử lý dữ liệu và cổng API tập trung cho toàn bộ hệ sinh thái Web FU-DEVER:
- **Xác thực & Bảo mật (Auth & Security):** JWT Token, mã hóa mật khẩu Bcrypt, phân quyền theo vai trò (User, Member, Admin, President).
- **Hệ thống Gamification & Điểm danh vọng:** Bảng xếp hạng Hall of Fame, chuỗi ngày Streak, tính toán EXP tự động khi giải bài LeetCode hoặc viết Blog.
- **Tích hợp Cloudflare R2 Storage:** Quản lý tải lên hình ảnh, tài liệu và avatar tốc độ cao chuẩn giao thức S3.
- **Cầu nối Telegram Bot Automation (@Fudever_bot):** Tự động gửi thông báo tức thì tới Ban Quản Trị và Ban Chủ Nhiệm khi có bài viết mới, dự án Open Source cần duyệt hoặc cảnh báo hệ thống.
- **Quản lý dữ liệu học thuật:** Cung cấp API cho Sự kiện, Bài viết kỹ thuật, Album hoạt động, Dự án Lab, Tài nguyên PE FPTU.

---

## 🚀 Điểm Kiểm Tra Trạng Thái (Health & Monitoring)

- **Liveness Health Check:** `GET /health` ➔ `{"status": "ok"}`
- **Readiness Check (MongoDB Connection):** `GET /ready` ➔ `{"status": "ready"}`
- **Tài liệu API (Swagger Docs):** `GET /docs` khi chạy ở chế độ dev.

---

## 💻 Cài Đặt & Chạy Cục Bộ (Local Development)

### Yêu cầu:
- Node.js 20+
- Chuỗi kết nối MongoDB Atlas (hoặc MongoDB Local)

### 1. Cài đặt dependencies:
```bash
git clone https://github.com/fudever-club/dever-backend.git
cd dever-backend
npm ci
```

### 2. Cấu hình biến môi trường:
Tạo file `.env`:
```env
PORT=5000
NODE_ENV=development
DB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?appName=FU-DEVER
APP_SECRET=fu_dever_secret_key_2026_super_secure
JWT_SECRET=fu_dever_secret_key_2026_super_secure
CORS_ORIGINS=http://localhost:3000,http://localhost:3002,http://localhost:3003,https://fudever.com,https://client.fudever.com,https://admin.fudever.com
LANDING_URL=https://fudever.com
CLIENT_URL=https://client.fudever.com
ADMIN_URL=https://admin.fudever.com
```

### 3. Khởi chạy máy chủ API:
```bash
npm run dev
```
API sẽ lắng nghe tại: `http://localhost:5000`

---

## 🧪 Đóng Gói & Triển Khai (Build & Deploy)

```bash
# Biên dịch TypeScript sang JavaScript
npm run build

# Khởi chạy bản dựng Production
npm run start
```

---

## 📄 Bản Quyền & Giấy Phép (License)

Dự án được phát triển và duy trì bởi **Ban Kỹ Thuật Câu lạc bộ Lập trình FU-DEVER** - Đại học FPT Đà Nẵng.  
Phát hành theo giấy phép [MIT License](LICENSE).
