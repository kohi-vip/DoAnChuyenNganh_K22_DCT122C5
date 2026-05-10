# DoAnChuyenNganh_K22_DCT122C5

Đây là repository đồ án chuyên ngành cho môn học học kì II năm 2025-2026, trong đó phần triển khai ứng dụng chính nằm ở thư mục `Main_Project`.

Các thành viên thực hiện:
-Lâm Quang Khôi - 31224111000
-Nguyễn Trọng Nghĩa - 3122411132
-Huỳnh Thanh Tuấn - 3122411234
-Nguyễn Trần Trung Thạch - 3122411186

Ứng dụng gồm 4 thành phần chạy cùng nhau:

- `BE`: Backend API viết bằng FastAPI.
- `FE`: Frontend viết bằng React + Vite.
- `db`: MySQL 8.0.
- `n8n`: workflow tự động hóa cho trợ lý AI (Jelly chat) và OCR hóa đơn.

## 1) Cấu trúc tổ chức file

```text
Main_Project/
	docker-compose.yml
	Task_Update_Require.txt
	BE/
		Dockerfile
		requirements.txt
		pyproject.toml
		.env.example
		n8n_to_interface.json
		OCR_only.json
		src/finance_svc/
			asgi.py
			core/
			models/
			schemas/
			services/
			views/
		tests/
			test_e2e.py
			test_transactions.py
			test_jelly_chat.py
			test_images/
	FE/
		Dockerfile
		package.json
		vite.config.js
		.env.example
		src/
			api/
			components/
			pages/
			stores/
			__tests__/
	init_SQL/
		init.sql
		update_db.sql/
```

### Vai trò từng khu vực

- `Main_Project/docker-compose.yml`
	Điều phối toàn bộ stack: MySQL, Backend, Frontend, n8n.

- `Main_Project/BE/src/finance_svc`
	Mã nguồn backend theo tầng: cấu hình (`core`), model DB (`models`), schema (`schemas`), xử lý nghiệp vụ (`services`), router API (`views`).

- `Main_Project/BE/tests`
	Test backend bằng `pytest`, gồm API cơ bản, transaction flow, AI/Jelly chat và OCR.

- `Main_Project/FE/src`
	Mã nguồn frontend, tách theo `components`, `pages`, `stores`, `api`.

- `Main_Project/init_SQL/init.sql`
	Script khởi tạo schema + seed dữ liệu MySQL (bao gồm tài khoản test).

- `Main_Project/Test_AI_OCR`
	Bộ workflow n8n dạng template (placeholder) để import nhanh khi setup OCR/Jelly.

## 2) Yêu cầu môi trường

Bạn có thể chạy theo 2 cách: Docker (khuyến nghị) hoặc local thủ công.

### Bắt buộc

- Docker Desktop + Docker Compose plugin.

### Tùy chọn (nếu chạy local thủ công)

- Python 3.12+
- Node.js 20+
- npm 9+
- MySQL 8.0+

## 3) Chuẩn bị biến môi trường

Tạo file `.env` từ các file mẫu:

```bash
# Từ thư mục Main_Project
copy BE\.env.example BE\.env
copy FE\.env.example FE\.env
```

Trên PowerShell có thể dùng:

```powershell
Copy-Item BE/.env.example BE/.env
Copy-Item FE/.env.example FE/.env
```

### Giá trị quan trọng cần chỉnh

`BE/.env`:

- `DATABASE_URL`
- `SECRET_KEY`
- `GROQ_API_KEY`
- `VERYFI_CLIENT_ID`
- `VERYFI_CLIENT_SECRET` (nếu workflow hoặc service của bạn dùng)
- `VERYFI_USERNAME`
- `VERYFI_API_KEY`
- `N8N_WEBHOOK_URL`
- `N8N_OCR_WEBHOOK_URL`
- `CORS_ORIGINS` (ví dụ `http://localhost:5174` khi chạy qua compose)

`FE/.env`:

- `VITE_API_BASE_URL` (ví dụ `http://localhost:8011`)

## 4) Setup n8n từ đầu (Jelly chat + OCR)

Phần này nên làm ngay sau khi đã chạy `docker compose up` và truy cập được n8n.

### Bước 1: mở n8n

- URL: `http://localhost:5678`

### Bước 2: import workflow

Khuyến nghị import từ bộ template trong `Main_Project/Test_AI_OCR`:

- `OCR_only.json`
- `n8n to interface.json`

Lý do dùng bộ này: đã để placeholder, phù hợp để tự điền credential mới.

### Bước 3: cấu hình credential trong n8n

Trong workflow cần điền:

- Groq credential cho node model chat.
- Veryfi credential trong node HTTP Request OCR:
	- Header `CLIENT-ID`
	- Header `AUTHORIZATION` theo format: `apikey YOUR_USERNAME:YOUR_API_KEY`

Lưu ý bảo mật:

- Không commit API key thật lên Git.
- Nếu đã từng lộ key, cần rotate/revoke key trước khi dùng tiếp.

### Bước 4: nối workflow OCR vào workflow chat

Trong workflow chat (`n8n to interface.json`), node dạng tool workflow (`Call 'OCR'`) cần chọn đúng `workflowId` của OCR workflow đã import.

### Bước 5: active workflow

- Bật Active cho cả workflow chat và workflow OCR.

### Bước 6: lấy webhook URL và gán vào backend

Trong n8n, lấy Production Webhook URL thực tế:

- Webhook Jelly chat: dùng cho `N8N_WEBHOOK_URL`
- Webhook OCR: dùng cho `N8N_OCR_WEBHOOK_URL`

Sau đó cập nhật lại trong `BE/.env` (hoặc biến môi trường trong Compose), rồi restart backend.

## 5) Chạy toàn bộ bằng Docker (khuyến nghị)

Di chuyển vào thư mục `Main_Project` rồi chạy:

```bash
docker compose up --build -d
```

Xem log realtime:

```bash
docker compose logs -f
```

Dừng stack:

```bash
docker compose down
```

Xóa luôn volume DB/n8n (nếu cần reset sạch):

```bash
docker compose down -v
```

### Port mặc định

- Frontend: `http://localhost:5174`
- Backend API: `http://localhost:8011`
- Swagger docs: `http://localhost:8011/docs`
- n8n: `http://localhost:5678`
- MySQL host port: `3307`

## 6) Chạy local thủ công (không Docker)

## 6.1 Backend

```bash
cd Main_Project/BE
pip install -r requirements.txt
set PYTHONPATH=src
uvicorn finance_svc.asgi:app --host 0.0.0.0 --port 8000 --reload
```

Trên PowerShell:

```powershell
$env:PYTHONPATH = "src"
uvicorn finance_svc.asgi:app --host 0.0.0.0 --port 8000 --reload
```

## 6.2 Frontend

```bash
cd Main_Project/FE
npm install
npm run dev
```

## 6.3 MySQL + n8n

Có thể chạy riêng bằng Docker, hoặc tự cài local.

Nếu chạy DB/n8n bằng Docker, backend/frontend chạy local thì vẫn dùng được miễn là URL trong `.env` trỏ đúng host/port.

## 7) Chạy test

## 7.1 Backend test (pytest)

```bash
cd Main_Project/BE
set PYTHONPATH=src
pytest -q
```

Trên PowerShell:

```powershell
$env:PYTHONPATH = "src"
pytest -q
```

Ghi chú:

- `test_jelly_chat.py` có nhóm test mock (chạy không cần n8n thật).
- Các test gọi n8n thật sẽ tự `skip` nếu chưa có `N8N_WEBHOOK_URL` hoặc `N8N_OCR_WEBHOOK_URL` hợp lệ.
- Test dùng ảnh thật sẽ `skip` nếu thư mục `tests/test_images` không có ảnh.

## 7.2 Frontend test (Vitest)

```bash
cd Main_Project/FE
npm install
npm run test
```

Chạy watch mode:

```bash
npm run test:watch
```

## 7.3 Chạy test trong container

Backend:

```bash
docker compose exec backend pytest -q tests
```

Frontend:

```bash
docker compose exec frontend npm run test
```

## 8) Tài khoản seed để đăng nhập nhanh

`init_SQL/init.sql` có sẵn tài khoản test:

- Email: `test@caisocai.vn`
- Password plain text dự kiến: `Test@1234`

Nếu login không khớp (do hash thay đổi), tạo lại hash bcrypt trong script SQL theo ghi chú trong file `init.sql`.

## 9) Một số lỗi thường gặp và cách xử lý

1. Frontend gọi API lỗi CORS hoặc sai host

- Kiểm tra `FE/.env` với `VITE_API_BASE_URL`.
- Kiểm tra `BE/.env` với `CORS_ORIGINS`.

2. Chat Jelly/OCR trả lỗi timeout hoặc không có phản hồi

- Kiểm tra workflow n8n đã Active chưa.
- Kiểm tra `N8N_WEBHOOK_URL` và `N8N_OCR_WEBHOOK_URL` đã là Production URL đúng chưa.

3. OCR không đọc được hoặc Veryfi 401

- Kiểm tra lại format header `AUTHORIZATION` trong node OCR.
- Đảm bảo không dùng nhầm key hoặc key đã hết hiệu lực.

4. Backend lên nhưng DB lỗi kết nối

- Kiểm tra `DATABASE_URL`.
- Nếu chạy qua compose, host DB nên là `db` trong network compose.

---

Nếu cần mở rộng tính năng AI/OCR, nên dùng thư mục `Test_AI_OCR` làm workflow mẫu, sau đó version hóa lại các workflow đã làm sạch credential trước khi commit.