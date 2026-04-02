# Personal Finance Frontend

Frontend quản lý tài chính cá nhân được xây dựng bằng React + Vite + Tailwind CSS.

## Yêu cầu môi trường

- Node.js 18+ (khuyến nghị Node.js 20+)
- npm 9+

## Cài đặt và chạy local

1. Cài dependencies:

```bash
npm install
```

2. Chạy môi trường dev:

```bash
npm run dev
```

3. Mở trình duyệt theo URL Vite in ra trong terminal (thường là `http://localhost:5173`).

## Tài khoản test local

Khi backend chưa có endpoint auth (trả 404), ứng dụng sẽ dùng local mode.

- Email: `demo.finance@example.com`
- Mật khẩu mặc định: `12345678Nguyen`

Lưu ý: nếu bạn đã đổi mật khẩu trong trang Cài đặt tài khoản, lần đăng nhập tiếp theo phải dùng mật khẩu mới.

## Dữ liệu test và cơ chế lưu

- Dữ liệu khởi tạo lấy từ `src/utils/seedData.js`.
- Sau lần chạy đầu, app sẽ lưu dữ liệu vào `localStorage` để không bị mất khi reload:
	- users
	- wallets
	- categories
	- transactions

Vì vậy khi test frontend:

- Thêm/sửa/xóa giao dịch sẽ được giữ lại sau F5.
- Đổi mật khẩu ở local mode sẽ đăng nhập lại được bằng mật khẩu mới.

## Reset dữ liệu về seed ban đầu

Nếu cần reset dữ liệu test, mở DevTools và xóa các key localStorage sau:

- `pfm_local_data_v1`
- `pfm_auth_session`
- `pfm_auth_user`
- `access_token`
- `refresh_token`

Sau đó reload lại trang.

## Các lệnh hữu ích

- Chạy dev: `npm run dev`
- Build production: `npm run build`
- Preview bản build: `npm run preview`
- Lint: `npm run lint`
