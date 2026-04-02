# Hướng Dẫn Cài Đặt OCR (n8n + Veryfi)

## 1) Credential cần tạo

- Veryfi Client ID
- Veryfi Username
- Veryfi API Key
- Groq API Key (nếu dùng AI Agent với Groq)

## 2) API/endpoint cần lấy

- Chat webhook URL từ node When chat message received
- Veryfi OCR endpoint:
  - https://api.veryfi.com/api/v8/partner/documents/

## 3) Cách lấy key Veryfi (ngắn gọn)

- Đăng nhập Veryfi dashboard
- Vào phần API keys / credentials
- Lấy 3 giá trị:
  - Client ID
  - Username
  - API Key
- Lưu ý:
  - Không public key lên GitHub
  - Nếu lộ key thì rotate/revoke ngay

## 4) Setup node HTTP Request (OCR tool)

- Method: POST
- URL: https://api.veryfi.com/api/v8/partner/documents/
- Authentication: None
- Send Headers: On
- Send Body: On
- Body Content Type: JSON

### Headers

- CLIENT-ID: YOUR_VERYFI_CLIENT_ID
- AUTHORIZATION: apikey YOUR_USERNAME:YOUR_API_KEY
- Content-Type: application/json
- Accept: application/json

### Body (Using Fields Below)

- file_name = {{$json.image.name || "upload.jpg"}}
- file_data = {{$json.image.data}}
- categories = {{["other"]}}

## 5) Lưu ý lỗi thường gặp

- 401 Not Authorized:
  - Sai AUTHORIZATION format
  - Thiếu chữ apikey ở đầu
  - Dùng nhầm CLIENT SECRET thay vì API KEY
- JSON parameter needs to be valid JSON:
  - Sai body format
  - Nên chọn Using Fields Below để tránh lỗi parse

## 6) Flow OCR đề xuất (cuối cùng)

- When chat message received
- Code node text and image
- If hasImage
  - True: HTTP OCR -> parse OCR to text -> Information Agent
  - False: Information Agent

## 7) Placeholder format để chia sẻ công khai

- YOUR_VERYFI_CLIENT_ID
- apikey YOUR_USERNAME:YOUR_API_KEY
- YOUR_GROQ_API_KEY
- YOUR_CHAT_WEBHOOK_URL
