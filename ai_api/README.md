# 🤖 AI API — Hướng dẫn sử dụng

## Cài đặt

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your-api-key-here"
uvicorn main:app --reload --port 8000
```

Sau khi chạy, mở: http://localhost:8000/docs để dùng giao diện thử API

---

## Các Endpoint

### 1. 💬 Chat thông minh
**POST** `/chat`

```json
{
  "user_id": "user123",
  "message": "Xin chào!",
  "system_prompt": "Bạn là chuyên gia tài chính tên Minh",
  "reset": false
}
```

- `user_id`: Định danh người dùng — mỗi người có lịch sử riêng
- `system_prompt`: Tùy chỉnh tính cách AI (bỏ trống = mặc định)
- `reset`: `true` để xóa lịch sử cũ

---

### 2. 💻 Viết code tối ưu
**POST** `/code`

```json
{
  "user_id": "dev1",
  "task": "Viết thuật toán sắp xếp nhanh nhất",
  "language": "python",
  "optimize_level": "maximum"
}
```

- `language`: python, javascript, go, rust, java, ...
- `optimize_level`: `basic` | `good` | `maximum`

---

### 3. 📊 Tạo PowerPoint
**POST** `/powerpoint`

```json
{
  "title": "Chiến lược Marketing 2025",
  "topic": "Xu hướng digital marketing",
  "num_slides": 6,
  "style": "professional"
}
```

Hoặc tự cung cấp nội dung slide:
```json
{
  "title": "Báo cáo Q4",
  "topic": "Kết quả kinh doanh",
  "style": "modern",
  "slides": [
    {
      "title": "Tổng quan",
      "points": ["Doanh thu tăng 25%", "150 khách hàng mới", "Mở rộng 3 thị trường"],
      "note": "Highlight điểm doanh thu"
    }
  ]
}
```

**Style:** `professional` | `modern` | `minimal` | `colorful`

---

### 4. 🗑️ Xóa session
**DELETE** `/session/{user_id}`

---

### 5. 📋 Xem sessions
**GET** `/sessions`

---

## Ví dụ dùng với Python

```python
import requests

BASE = "http://localhost:8000"

# Chat
r = requests.post(f"{BASE}/chat", json={
    "user_id": "alice",
    "message": "Giải thích machine learning cho tôi"
})
print(r.json()["reply"])

# Tạo PowerPoint
r = requests.post(f"{BASE}/powerpoint", json={
    "title": "AI trong Giáo dục",
    "topic": "Ứng dụng AI tại trường học",
    "num_slides": 5,
    "style": "modern"
})
with open("presentation.pptx", "wb") as f:
    f.write(r.content)
print("Đã tải file PowerPoint!")
```
