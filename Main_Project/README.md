(# Main_Project — Folder structure

Dưới đây là cây thư mục của `Main_Project` được quét tự động.

```
Main_Project/
├─ .gitignore
├─ README.md
├─ BE/
│  ├─ .env.example
│  ├─ .gitignore
│  ├─ requirements.txt
│  └─ app/
│     ├─ __init__.py
│     └─ main.py
└─ FE/
	├─ .gitignore
	├─ README.md
	├─ index.html
	├─ package.json
	├─ package-lock.json
	├─ vite.config.js
	├─ eslint.config.js
	├─ src/
	│  ├─ main.jsx
	│  ├─ App.jsx
	│  ├─ App.css
	│  └─ index.css
	└─ public/
		├─ favicon.svg
		└─ icons.svg
```

Nếu bạn muốn, mình có thể:

- Thêm mô tả ngắn cho từng thư mục (`BE` / `FE`).
- Tạo file `docker-compose.yml` để chạy đồng bộ FE + BE.
- Thêm cấu trúc module (routers, services, models) cho FastAPI.

---
_Cập nhật tự động bởi Copilot._
