# Panduan Deployment SawiTrack (MERN) di Jagoan Hosting

Panduan ini menjelaskan cara melakukan hosting aplikasi MERN Stack (MongoDB, Express, React, Node.js) di layanan shared hosting berbasis cPanel seperti Jagoan Hosting.

## Prasyarat Utama

Hosting berbasis cPanel (Shared/Cloud) umumnya **tidak mendukung** database MongoDB local.

1.  **MongoDB Atlas:** Anda wajib menggunakan database cloud.
    *   Buat akun di [MongoDB Atlas](https://www.mongodb.com/atlas).
    *   Whitelist IP: `0.0.0.0/0` (Network Access > Add IP Address > Allow Access from Anywhere) agar server hosting bisa terhubung.
    *   Siapkan **Connection String** (format: `mongodb+srv://...`).

## Langkah 1: Persiapan Repository

Pastikan file konfigurasi siap untuk produksi.
*   **Routing React:** File `public/.htaccess` sudah ditambahkan otomatis ke project Anda. Ini penting agar saat user me-refresh halaman, tidak muncul error 404 dari server.

Pastikan seluruh kode project sudah di-upload ke GitHub repository Anda.

## Langkah 2: Konfigurasi Backend (Node.js) di cPanel

1.  **Clone Repository:**
    *   Login ke cPanel.
    *   Buka menu **Git™ Version Control**.
    *   Klik **Create**.
    *   **Clone URL:** Masukkan URL repository GitHub Anda.
    *   **Repository Path:** Isi path di luar public_html agar aman, misal: `repositories/SawiTrack`.
    *   Klik **Create**.

2.  **Setup Node.js App:**
    *   Buka menu **Setup Node.js App** di cPanel.
    *   Klik **Create Application**.
    *   **Node.js Version:** Pilih versi LTS (misal 20.x).
    *   **Application Mode:** Pilih `Production`.
    *   **Application Root:** Masukkan path tempat repo backend berada.
        *   Contoh: `repositories/SawiTrack/backend` (Sesuai struktur folder repo Anda).
    *   **Application URL:** Pilih domain/subdomain untuk API backend.
        *   Disarankan membuat subdomain seperti `api.domainanda.com`.
    *   **Application Startup File:** `src/index.js`.
    *   Klik **Create**.

3.  **Install Dependencies & Environment:**
    *   Setelah app dibuat, di halaman detail app, klik tombol **Run NPM Install** (pastikan `package.json` backend terdeteksi).
    *   Scroll ke bawah ke bagian **Environment Variables**.
    *   Tambahkan variabel sesuai `.env` backend Anda:
        *   `MONGO_ATLAS_URI`: `mongodb+srv://user:pass@cluster...`
        *   `JWT_SECRET`: `rahasia_anda_di_sini`
        *   `NODE_ENV`: `production`
    *   Klik **Restart** pada aplikasi Node.js.

## Langkah 3: Konfigurasi Frontend (React/Vite)

Frontend React adalah aplikasi statis setelah di-build. Kita akan menaruh hasil build di `public_html`.

1.  **Build Project di Lokal:**
    Buka terminal VS Code di PC Anda, jalankan:
    ```bash
    npm run build
    ```
    Perintah ini akan menghasilkan folder `dist`.

2.  **Upload Manual (Opsi A):**
    *   Buka **File Manager** di cPanel.
    *   Buka folder `public_html` (atau folder subdomain frontend Anda).
    *   Upload **seluruh isi** folder `dist` (index.html, folder assets, file .htaccess, dll).

## Langkah 4: Automatisasi dengan GitHub Actions (CI/CD)

Agar frontend otomatis ter-update saat Anda push ke GitHub, setup workflow berikut.

1.  Di GitHub Repository Anda file `.github/workflows/deploy-frontend.yml` (buat jika belum ada).

2.  Isi file tersebut dengan:

```yaml
name: Deploy Frontend
on:
  push:
    branches: [ main ]
jobs:
  web-deploy:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
    - name: Get latest code
      uses: actions/checkout@v4
    
    - name: Use Node.js 20
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        
    - name: Build Project
      run: |
        npm install
        npm run build
        
    - name: CyberDuck/FTP Upload
      uses: SamKirkland/FTP-Deploy-Action@v4.3.5
      with:
        server: ${{ secrets.FTP_SERVER }}
        username: ${{ secrets.FTP_USERNAME }}
        password: ${{ secrets.FTP_PASSWORD }}
        local-dir: ./dist/
        server-dir: ./public_html/
```

3.  **Setup Secrets:**
    *   Di GitHub Repo, masuk ke **Settings > Secrets and variables > Actions**.
    *   Klik **New repository secret**.
    *   Tambahkan 3 secret:
        *   `FTP_SERVER`: Alamat IP hosting atau hostname (ftp.domain.com).
        *   `FTP_USERNAME`: Username cPanel/FTP.
        *   `FTP_PASSWORD`: Password cPanel/FTP.

Sekarang frontend Anda fully automated!

## Catatan Update Backend
Untuk update Backend (karena menggunakan cPanel Node.js Selector):
1.  Push code ke GitHub.
2.  Buka cPanel > **Git Version Control** > Klik **Pull**.
3.  Buka cPanel > **Setup Node.js App** > Klik **Restart** (agar perubahan kode terbaca).

## Troubleshooting: API Masih Mengarah ke Localhost?

Jika setelah deploy frontend masih mencoba mengakses `localhost` (cek di Console browser):

1.  **Penyebab:** Variable `.env` di Vite **di-compile saat build**. Mengganti file `.env` di server (File Manager) **TIDAK** akan mengubah kode yang sudah jadi (di folder `dist`).
2.  **Solusi:**
    *   Pastikan file `.env.production` di komputer lokal Anda sudah berisi URL backend yang benar:
        ```env
        VITE_API_BASE_URL=https://api.domainanda.com/api
        ```
    *   Jalankan build ulang di komputer lokal:
        ```bash
        npm run build
        ```
    *   Upload ulang isi folder `dist` yang baru ke `public_html` di cPanel.

