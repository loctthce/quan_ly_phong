# 🏫 Quản Lý Phòng Học — Dự án 19

Ứng dụng quản lý thời khóa biểu phòng học cho trung tâm, chạy trên **Vercel** + **Supabase**.

---

## 🚀 Cài đặt & Deploy

### 1. Tạo Supabase Project

1. Truy cập [https://supabase.com](https://supabase.com) → **New project**
2. Đặt tên project, chọn region gần nhất (Singapore)
3. Sau khi tạo xong → vào **Project Settings → API**:
   - Copy **Project URL** (dạng `https://xxxx.supabase.co`)
   - Copy **anon public key**

---

### 2. Tạo các bảng trong Supabase

Vào **SQL Editor** trong Supabase và chạy lần lượt các lệnh SQL sau:

```sql
-- =============================================
-- BẢNG: rooms (Phòng học)
-- =============================================
CREATE TABLE rooms (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order  INT  DEFAULT 99,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BẢNG: teachers (Giáo viên)
-- =============================================
CREATE TABLE teachers (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  color      TEXT DEFAULT '#4f46e5',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BẢNG: timeslots (Ca học / Giờ học)
-- =============================================
CREATE TABLE timeslots (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  sort_order INT  DEFAULT 99,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BẢNG: schedules (Lịch phân công)
-- =============================================
CREATE TABLE schedules (
  id          BIGSERIAL PRIMARY KEY,
  room_id     BIGINT REFERENCES rooms(id)     ON DELETE CASCADE,
  teacher_id  BIGINT REFERENCES teachers(id)  ON DELETE CASCADE,
  timeslot_id BIGINT REFERENCES timeslots(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 2 AND 8),
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index để tăng tốc truy vấn TKB
CREATE INDEX idx_schedules_room    ON schedules(room_id);
CREATE INDEX idx_schedules_day     ON schedules(day_of_week);
CREATE INDEX idx_schedules_teacher ON schedules(teacher_id);
```

---

### 3. Bật Row Level Security (RLS) — Tùy chọn

Nếu ứng dụng chỉ dùng nội bộ (không public), bạn có thể bỏ qua RLS hoặc bật với policy cho phép tất cả:

```sql
-- Cho phép đọc/ghi không cần auth (dùng nội bộ)
ALTER TABLE rooms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeslots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON rooms      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON teachers   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON timeslots  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON schedules  FOR ALL USING (true) WITH CHECK (true);
```

---

### 4. Deploy lên Vercel

1. Push thư mục `Du an 19` lên GitHub
2. Vào [https://vercel.com](https://vercel.com) → **New Project** → chọn repo
3. Deploy (không cần build command, là static site)

---

### 5. Kết nối ứng dụng với Supabase

Khi mở ứng dụng lần đầu, một form **Kết nối Supabase** sẽ hiện ra:
- Nhập **Supabase URL** và **Anon Key** vừa copy ở bước 1
- Nhấn **Kết nối & Lưu**

Thông tin được lưu vào `localStorage` của trình duyệt (không gửi đi đâu).

---

## 📖 Hướng dẫn sử dụng

### Thứ tự thiết lập ban đầu:

1. **🚪 Quản Lý Phòng** → Thêm các phòng học (Phòng A1, Phòng B2...)
2. **👨‍🏫 Giáo Viên** → Thêm danh sách giáo viên và chọn màu nhận diện
3. **🕐 Giờ Học** → Thiết lập các ca học (Ca sáng 7:30–9:30, Ca chiều...)
4. **✏️ Phân Công Lịch** → Gán giáo viên vào phòng theo thứ và giờ học
5. **📅 Thời Khóa Biểu** → Xem toàn bộ lịch dưới dạng bảng

### Quy tắc day_of_week:
| Giá trị | Ngày |
|---------|------|
| 2 | Thứ Hai |
| 3 | Thứ Ba |
| 4 | Thứ Tư |
| 5 | Thứ Năm |
| 6 | Thứ Sáu |
| 7 | Thứ Bảy |
| 8 | Chủ Nhật |

### Màu hiển thị ca học (tự động theo giờ):
- 🌅 **Vàng** — Buổi sáng (trước 12:00)
- ☀️ **Xanh dương** — Buổi chiều (12:00–18:00)
- 🌙 **Tím** — Buổi tối (sau 18:00)

---

## 🗂️ Cấu trúc file

```
Du an 19/
├── index.html          # Giao diện chính
├── style.css           # CSS toàn bộ ứng dụng
├── supabase-client.js  # Supabase client + hàm CRUD
├── app.js              # Logic ứng dụng
├── vercel.json         # Config deploy Vercel
└── README.md           # Hướng dẫn này
```
