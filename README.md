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

### Opsi 2 — Online via Internet (deploy gratis)

Upload ke GitHub, lalu deploy ke [Render](https://render.com):

1. Push project ini ke GitHub
2. Buat akun Render → **New Web Service**
3. Connect repository GitHub kamu
4. Setting:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Deploy → dapat URL seperti `https://nama-game.onrender.com`
6. Bagikan URL itu ke teman — semua buka link yang sama untuk main bareng

> **Catatan:** Render free tier bisa sleep jika tidak dipakai. Tunggu ~30 detik saat pertama buka.

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

## Teknologi

- Node.js + Express + Socket.io
- Three.js