# Raspberry Pi SOS Dialer

สคริปต์นี้ทำให้ Raspberry Pi สามารถกดปุ่มฮาร์ดแวร์เพื่อโทร SOS เข้าระบบ LiveKit ได้โดยอัตโนมัติ โดยจะยิง REST API เพื่อเปิดห้อง, ต่อกล้อง/ไมค์, และเปิดเสียงรอ “ตู้ด ๆ” ไปเรื่อยๆ จนกว่าจะมีอีกฝั่งรับสาย ไม่มีส่วนที่ต้องกดในเบราว์เซอร์

## คุณสมบัติหลัก

- สั่งงานผ่านปุ่มกดที่ต่อกับ GPIO เพียงจุดเดียว
- ทำงาน headless: ขอ LiveKit token, เชื่อมห้อง, เปิดเสียงรอ และตัดสายเองเมื่อครบเวลาที่กำหนด
- รองรับการตั้งค่า (URL, PIN, เสียงรอ, timeout) ผ่าน `.env`
- ออกแบบให้รันเป็น `systemd service` ได้ เพื่อเริ่มทำงานตั้งแต่ Pi บูต

## โครงสร้างไฟล์

- `sos_call.py` — main entrypoint ฟังเหตุการณ์จากปุ่มกด
- `dialer.py` — รวม workflow สร้าง SOS event, ขอ token, เข้าห้อง LiveKit, ควบคุมเสียงรอ
- `tone.py` — ตัวช่วยเล่นไฟล์ `.wav` วนลูปผ่าน `simpleaudio`
- `.env.example` — ตัวอย่างตัวแปรแวดล้อม
- `requirements.txt` — ไลบรารี Python ที่จำเป็น (รองรับ ARM)

## ความต้องการ

### ฮาร์ดแวร์

- Raspberry Pi 3/4/5 (แนะนำรุ่นที่มี RAM ≥ 2GB)
- ปุ่มกดแบบ momentary + ตัวต้านทานดึงลง (หากใช้ปุ่มธรรมดาต่อกับ GND ตามไดอะแกรมก็เพียงพอ)
- USB Camera + USB Microphone (หรือชุด USB speakerphone ที่รองรับ UVC/UAC)
- ลำโพง/หูฟัง (สำหรับเสียงรอและการสนทนา)

### ซอฟต์แวร์

- Raspberry Pi OS (64-bit) รุ่นล่าสุด
- Python 3.9+ (ใน Pi OS มีมาให้แล้ว)
- สามารถเชื่อมต่ออินเทอร์เน็ตเพื่อเรียก API ได้

## ขั้นตอนติดตั้งทีละขั้น

1. **อัปเดต OS และติดตั้งไลบรารีระบบ**
   ```bash
   sudo apt update && sudo apt install -y python3-pip python3-venv libasound2-dev ffmpeg
   ```
2. **คัดลอกโฟลเดอร์ `raspi-sos` ไปยัง Pi** (ผ่าน scp หรือ git)
3. **สร้าง virtualenv และติดตั้ง dependencies**
   ```bash
   cd ~/raspi-sos
   python3 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. **ตั้งค่าไฟล์ `.env`**
   - คัดลอก `.env.example` เป็น `.env`
   - แก้ URL ให้ตรงกับโดเมน production (อย่าใช้ `localhost`)
   - ตั้งค่า `WAIT_TONE_PATH` ให้ชี้ไปยังไฟล์ `.wav` บน Pi
5. **ทดสอบกล้อง/ไมค์**
   - รัน `raspi-config` เพื่อ enable camera, I2S/ALSA ตามที่ใช้
   - ใช้ `arecord -l` และ `arecord -D plughw:1,0 -f cd -d 3 test.wav` เพื่อตรวจสอบเสียงเข้า/ออก

## ตัวแปรแวดล้อม (ตั้งใน `.env`)

| ชื่อ                     | ตัวอย่าง                             | คำอธิบาย                                                |
| ------------------------ | ------------------------------------ | ------------------------------------------------------- |
| `API_BASE_URL`           | `https://your-app.example.com`       | Base URL ของ Next.js/Vercel ที่เปิด endpoint `/api/sos` |
| `STATION_ID`             | `ST001`                              | รหัสสถานี (แมพกับฝั่ง server)                           |
| `STATION_NAME`           | `สถานีบางรัก`                        | ชื่อสถานีที่จะแสดงใน dashboard                          |
| `LIVEKIT_URL`            | `wss://livekit.domain.com`           | WebSocket URL ของ LiveKit server                        |
| `GPIO_PIN`               | `17`                                 | หมายเลข GPIO ที่ต่อปุ่ม (โหมด BCM)                      |
| `BUTTON_DEBOUNCE`        | `0.05`                               | เวลาดีบาวน์ (วินาที) ป้องกันกดรัว                       |
| `WAIT_TONE_PATH`         | `/home/pi/raspi-sos/assets/wait.wav` | ไฟล์ .wav สำหรับเล่นเสียงรอ                             |
| `ACCEPT_TIMEOUT_SECONDS` | `90`                                 | เวลารอให้ admin รับสายก่อนตัด                           |

## การเชื่อมต่อปุ่มและอุปกรณ์เสียง

- ต่อปุ่มระหว่าง GPIO ตามค่าที่ตั้ง (เริ่มต้นคือ 17) กับ GND
- โค้ดใช้ `pull_up=True` จึงต้องต่อแบบให้สัญญาณลง 0V เมื่อกด
- หากต้องการใช้หลายปุ่ม สามารถโคลนสคริปต์และปรับ GPIO แยกได้
- ตรวจสอบไมค์/ลำโพงใน ALSA ด้วย `aplay -l` และ `arecord -l`

## การรันทดสอบแบบแมนนวล

```bash
cd ~/raspi-sos
source .venv/bin/activate
python sos_call.py
```

สิ่งที่คาดว่าจะเห็น:

1. Log “Waiting for button events…”
2. เมื่อกดปุ่ม จะมี log ว่า “Creating SOS event…”
3. หากเชื่อมต่อห้องสำเร็จ ไฟล์เสียงจะเริ่มเล่น และจะหยุดเมื่ออีกฝั่งเข้าห้องหรือเมื่อ timeout

## รันอัตโนมัติด้วย systemd

1. สร้างไฟล์ `/etc/systemd/system/sos-dialer.service`

   ```ini
   [Unit]
   Description=Raspberry Pi SOS Dialer
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   WorkingDirectory=/home/pi/raspi-sos
   Environment=\"PYTHONUNBUFFERED=1\"
   ExecStart=/home/pi/raspi-sos/.venv/bin/python /home/pi/raspi-sos/sos_call.py
   Restart=always
   User=pi

   [Install]
   WantedBy=multi-user.target
   ```

2. สั่งรันและดูสถานะ
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now sos-dialer.service
   sudo systemctl status sos-dialer.service
   journalctl -u sos-dialer.service -f   # ดู log แบบ real-time
   ```

## การดูแลและแก้ไขปัญหา

- **ไม่มีเสียงรอ** → ตรวจสอบว่าไฟล์ `.wav` มีอยู่จริงและ `simpleaudio` ติดตั้งแล้ว (`pip show simpleaudio`)
- **ไม่ได้รับ LiveKit token** → ลอง `curl https://domain/api/livekit/token?room=xxx&identity=station-...` จาก Pi เพื่อเช็ก network
- **ปุ่มไม่ตอบสนอง** → ใช้ `gpiozero` shell (`python -c "from gpiozero import Button; Button(17).wait_for_press()"`) ตรวจสอบ wiring
- **กล้อง/ไมค์ไม่ติด** → LiveKit agents จะสร้าง track จาก default device; หากมีหลายอุปกรณ์ให้ถอดตัวที่ไม่ใช้ หรือกำหนดค่า ALSA default
- **ต้องการ reset หลังเกิดข้อผิดพลาด** → service ถูกตั้งให้ `Restart=always` อยู่แล้ว แต่สามารถรัน `sudo systemctl restart sos-dialer.service` เพื่อบังคับได้

เมื่อทุกอย่างพร้อมแล้ว Raspberry Pi จะพร้อมให้เจ้าหน้าที่กดปุ่มเรียก SOS และรอให้อีกฝั่งรับสายโดยอัตโนมัติทันทีที่เครื่องบูต
