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

### Opsi 2 — Online via Internet (Render)

**Deploy 1-klik:** https://render.com/deploy?repo=https://github.com/IdrusShahab/stickman-fpp-online

Atau manual:
1. Login [Render](https://render.com) dengan GitHub
2. **New +** → **Blueprint** → pilih repo `stickman-fpp-online`
3. Deploy → dapat URL seperti `https://stickman-fpp-online.onrender.com`
4. Bagikan URL ke teman — semua buka link yang sama untuk main bareng

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