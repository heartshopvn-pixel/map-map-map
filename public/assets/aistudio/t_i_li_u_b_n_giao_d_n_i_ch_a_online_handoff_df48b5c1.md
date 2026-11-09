# 🏫 TÀI LIỆU BÀN GIAO KỸ THUẬT & VẬN HÀNH (PROJECT HANDOFF)
**Tên dự án:** Game Cô Thảo - Lớp Học Tương Tác TikTok Live & Dev Studio  
**Kiến trúc:** Web App (React + Vite) + Node.js Bridge (`server.js` / `tiktok-live-connector`)  

---

## 1. TỔNG QUAN KIẾN TRÚC
Dự án sử dụng kiến trúc **Web App tích hợp sẵn Live Dev Studio** kết hợp với **Node.js Bridge (`tiktok-live-connector`)**:
* **Giao diện kép (Dual-View):**
  * **Bên Trái (`GameStage`):** Khung hình Lớp Học tỷ lệ dọc `9:16` (`540x960` tự co giãn) dùng để chiếu lên OBS Studio hoặc TikTok Live Studio.
  * **Bên Phải (`DevPanel`):** Bảng điều khiển trực tiếp dành cho người vận hành (có thể ẩn/hiện nhanh sang chế độ Live Clean).
* **Đồng bộ thời gian thực (Multi-Tab Sync):**
  * Sử dụng song song **`BroadcastChannel API`** (khi mở 2 tab trên cùng trình duyệt) và **`WebSocket / Server Relay`** (khi chạy qua cầu nối giữa Chrome và OBS / TikTok Live Studio).
  * Mọi thao tác chỉnh sửa ở Tab Admin (thêm học sinh, kéo thả tọa độ bàn học, chỉnh âm lượng, ngắt âm khẩn cấp) đều cập nhật tức thì trên màn hình Live mà không cần tải lại trang (`F5`).

---

## 2. CƠ CHẾ HIỂN THỊ 2.5D & ĐIỀU PHỐI LỚP HỌC
1. **Phối cảnh chiều sâu giả lập 3D (2.5D Y-Sorting & Depth Scaling):**
   * Nhân vật học sinh xuất hiện từ cửa lớp, đi bộ tiến vào chỗ ngồi tại các dãy bàn đôi.
   * Tỷ lệ kích thước (`scale`) tự động thu nhỏ dần theo chiều sâu tọa độ `Y`, đồng thời `z-index` đảm bảo nhân vật đứng gần màn hình luôn hiển thị phía trước nhân vật ở xa.
2. **Phân tầng vị trí (Bàn Học & Bục Giảng):**
   * **Khu vực Bàn Học Đôi:** Các dãy bàn đôi dành cho học sinh tham gia trả lời câu hỏi Tiếng Anh, phát biểu và tương tác.
   * **Khu vực Bục Giảng & Giám Thị:** Vị trí của Cô Thảo trên bục giảng và Thầy Giám Thị đi tuần nhắc nhở trật tự.
3. **Live Map Editor (Chỉnh sửa tọa độ trực tiếp):**
   * Admin có thể dùng chuột kéo thả trực tiếp vị trí từng bàn học đôi, điều chỉnh khoảng cách học sinh với bàn học, khoảng cách 2 học sinh cùng bàn và kích thước các model quà tặng.
   * Hỗ trợ tải ảnh nền lớp học (`9:16`) từ máy tính và xuất/nhập cấu hình ra file `JSON`.

---

## 3. HỆ THỐNG GIỌNG ĐỌC ĐA NGUỒN (MULTI-ENGINE TTS) & ÂM THANH
* **Hiệu ứng âm thanh lớp học & sự kiện quà:** Hỗ trợ tùy chỉnh âm lượng riêng cho nhạc nền, giọng đọc TTS và từng sự kiện quà tặng trong thẻ Âm Thanh.
* **Các nguồn phát giọng đọc (TTS Engines):**
  1. **🎙️ Node.js Edge-TTS AI (`vi-VN-HoaiMyNeural` / `vi-VN-NamMinhNeural`):** Giọng AI Microsoft miễn phí qua thư viện `msedge-tts`.
  2. **🌐 Google Translate Stream (`translate_tts`):** Luồng Audio MP3 trực tiếp hỗ trợ cả Tiếng Việt và phát âm từ vựng Tiếng Anh.
  3. **⚡ Web Speech API (`window.speechSynthesis`):** Giọng đọc nội bộ của trình duyệt/Windows.

---

## 4. CHẾ ĐỘ "TAB ADMIN IM LẶNG" (LÀM VIỆC RIÊNG KHÔNG MẤT TIẾNG LIVE)
Để người vận hành có thể tắt tiếng trên tab điều khiển mà khán giả trên TikTok Live vẫn nghe đầy đủ âm thanh:
* **Công tắc `🔇 Tắt Tiếng Riêng Tab Này`:** Lưu trạng thái vào `sessionStorage` của riêng tab đang mở điều khiển.
* **Thiết lập trên OBS / TikTok Live Studio:**
  1. Tạo nguồn **Browser Source** trỏ vào link game (`?obs=1`).
  2. Bật kiểm soát âm thanh qua OBS / TikTok Live Studio để âm thanh phát thẳng lên luồng Live.

---

## 5. KHIÊN BẢO VỆ PHÒNG LIVE & BỘ LỌC TỪ CẤM TIKTOK (SAFETY SHIELD)
Hệ thống quét 2 lớp (**Tên người chơi** và **Nội dung bình luận**) với thuật toán chống lách luật (tự động xóa dấu chấm, gạch ngang, khoảng trắng cố tình chèn giữa chữ và chuẩn hóa không dấu):
* **Các nhóm từ điển cấm mặc định:**
  1. 🤬 Ngôn từ tục tĩu, nhạy cảm, 18+ & viết tắt.
  2. 🔊 Bẫy phát âm TTS / Tên nói lái nhạy cảm.
  3. 🔪 Bạo lực, tự hại, vũ khí & chất cấm.
  4. 🎲 Cờ bạc, cá độ, tài xỉu, lô đề & cổng game lừa đảo.
  5. 📱 Điều hướng nền tảng, số tài khoản & quét tự động số điện thoại / link web.
  6. ⚖️ Nội dung vi phạm tiêu chuẩn cộng đồng.
* **Nút đỏ `🔇 PANIC MUTE (Ngắt Đọc Khẩn Cấp)`:** Xóa sạch hàng đợi và ngắt lời giọng đọc ngay lập tức khi có tình huống bất ngờ.

---

## 6. HỆ THỐNG HỌC SINH NPC TỰ ĐỘNG GIỮ NHIỆT (SMART SEEDING NPC)
* **Hợp lệ chính sách TikTok 100%:** Hoạt động như học sinh NPC nội bộ trong khung hình game, không can thiệp vào hệ thống chat thật của TikTok.
* **Cơ chế Tự động nhường ghế & Trả lời câu hỏi:**
  * Duy trì số lượng học sinh NPC trong lớp và ngoài hành lang theo cấu hình.
  * Tùy chỉnh mật độ rải chat phát biểu tự nhiên của NPC và tỷ lệ NPC trả lời đúng/sai (im lặng hoặc gõ nhầm 2 chữ cái liền kề như người thật).
  * Tự động nhường chỗ ngồi khi có người xem thật trả lời đúng để vào lớp.

---

## 7. QUY TRÌNH KHỞI CHẠY NHANH (QUICK START CHECKLIST)
1. **Chạy trên máy hoặc GitHub Pages:**
   * Chạy `npm run dev` trên máy hoặc đẩy lên **GitHub Pages**.
2. **Đưa lên TikTok Live Studio / OBS Studio:**
   * Thêm nguồn **Browser Source** (`Width: 540`, `Height: 960` hoặc `1080x1920`) với đường dẫn kèm `?obs=1` để hiển thị giao diện Live sạch sẽ.