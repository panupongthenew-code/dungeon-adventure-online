DUNGEON ADVENTURE ONLINE — MOBILE

เพิ่ม:
- WebSocket Server (server.ts)
- สร้าง/เข้าห้องด้วย Room Code
- 2–4 ผู้เล่น
- Server เป็นผู้กำหนดเทิร์นและผลการทอย
- รอบสูงสุด 5 รอบ เกมจบอัตโนมัติเมื่อครบ 5 รอบ
- มีระบบ HP / EXP / Level / เงิน / มอนสเตอร์แบบเร็วเพื่อให้เกมจบใน 5 รอบ

ติดตั้ง:
npm install

รันเซิร์ฟเวอร์:
npm run server

เว็บมือถือ:
เปิด index.html

สำหรับออนไลน์จริง:
ต้องนำ server.ts ไปโฮสต์บนเครื่องที่ผู้เล่นอื่นเข้าถึงได้ และตั้ง WebSocket URL ให้ตรงกับโดเมน/พอร์ตของ server
