# Stickman FPP Online

Game multiplayer stickman sederhana — mode FPP/TPP di dalam ruangan.

## Cara Main (Lokal)

```bash
npm install
npm start
```

Buka: **http://localhost:3000**

## Main Bareng Teman

### Opsi 1 — Satu WiFi / LAN (paling mudah)

1. Jalankan server di PC kamu: `npm start`
2. Cari IP PC kamu:
   ```powershell
   ipconfig
   ```
   Catat IPv4 (contoh: `192.168.1.10`)
3. Teman buka browser: `http://192.168.1.10:3000`
4. Pastikan firewall Windows mengizinkan port **3000**

### Opsi 2 — Online via Internet (Cloudflare Tunnel) — GRATIS, tanpa kartu

**Cara termudah:** double-click `MAIN-BARENG.bat`

Atau manual:
1. Install tunnel (sekali saja):
   ```powershell
   winget install Cloudflare.cloudflared
   ```
2. Terminal 1 — jalankan server:
   ```powershell
   cd E:\TESTPROJECT
   npm start
   ```
3. Terminal 2 — buka tunnel:
   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```
4. Copy link `https://xxxx.trycloudflare.com` dari terminal 2
5. Bagikan link ke teman — semua buka link yang sama untuk main bareng

> **Catatan:** PC kamu harus nyala & server jalan saat main. Link berubah tiap restart tunnel.

## Kontrol

| Tombol | Fungsi |
|--------|--------|
| W/A/S/D | Gerakan |
| Shift | Lari |
| Space | Lompat |
| V | Ganti FPP / TPP |
| Klik kanan tahan | Orbit kamera |
| P | Pause |
| Enter | Chat |

### Kontrol HP (Mobile)

| Kontrol | Fungsi |
|---------|--------|
| Joystick kiri | Gerakan |
| Area kanan (drag) | Putar kamera |
| Lari | Tahan tombol |
| Lompat | Tap tombol |
| Chat | Buka chat |
| FPP/TPP | Ganti kamera |
| Pause | Jeda game |
| Mic (tahan) | Voice note |
| Insert (tahan, PC) | Voice note |

## Teknologi

- Node.js + Express + Socket.io
- Three.js