# SawiTrack

> Aplikasi manajemen dan pencatatan aktivitas lapangan perkebunan kelapa sawit berbasis web dan mobile

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

## 📋 Deskripsi

SawiTrack adalah aplikasi frontend modern untuk manajemen aktivitas lapangan perkebunan kelapa sawit. Aplikasi ini menyediakan sistem pencatatan, monitoring, dan pelaporan kegiatan lapangan dengan antarmuka yang responsif dan mudah digunakan.

**Status**: Demo Frontend (Autentikasi Mock)  
**URL Demo**: Coming Soon

## ✨ Fitur Utama

### 🔐 Autentikasi & Otorisasi
- Login dengan role-based access control
- Proteksi route berdasarkan role pengguna
- Session management dengan localStorage

### 📊 Dashboard & Monitoring
- Ringkasan aktivitas real-time
- Visualisasi data lapangan
- Quick access ke fitur utama

### 👥 Master Data (Manager Only)
- **Employees**: Manajemen data karyawan
- **Locations**: Manajemen lokasi kebun
- **Targets**: Setting target produksi

### 📝 Manajemen Aktivitas
- Input laporan kegiatan lapangan
- Riwayat aktivitas lengkap
- Verifikasi laporan (Foreman)
- Rekap & laporan terperinci

### 👤 Role-Based Features
- **Manager**: Full access ke semua fitur
- **Foreman**: Verifikasi laporan & monitoring tim
- **Employee**: Input & view aktivitas pribadi

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 atau lebih baru)
- npm atau yarn
- Git

### Instalasi
```bash
# Clone repository
git clone https://github.com/username/sawitrack.git
cd sawitrack

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

## 🧪 Akun Demo

Gunakan kredensial berikut untuk mencoba aplikasi:

| Role | Email | Password |
|------|-------|----------|
| 👔 Manager | `manager@sawit.com` | `manager123` |
| 👷 Foreman | `foreman@sawit.com` | `foreman123` |
| 👤 Employee | `employee@sawit.com` | `employee123` |

> ⚠️ **Note**: Kredensial ini hanya untuk demo dan disimpan di `src/contexts/AuthContext.tsx`

## 🛠️ Tech Stack

### Core
- **[Vite](https://vitejs.dev/)** - Build tool & dev server
- **[React 18](https://reactjs.org/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety

### Styling & UI
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS
- **[shadcn/ui](https://ui.shadcn.com/)** - Component library
- **[Lucide React](https://lucide.dev/)** - Icon library

### Code Quality
- **ESLint** - Code linting
- **TypeScript ESLint** - TS-specific rules

## 📁 Struktur Proyek
```
SawiTrack/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable components
│   │   ├── ui/         # shadcn/ui components
│   │   └── layout/     # Layout components
│   ├── pages/          # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Reports.tsx
│   │   └── ...
│   ├── contexts/       # React contexts
│   │   └── AuthContext.tsx
│   ├── lib/            # Utilities & helpers
│   ├── hooks/          # Custom hooks
│   ├── App.tsx         # App routing & providers
│   └── main.tsx        # Entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

## 📜 Available Scripts
```bash
# Development
npm run dev          # Start dev server with hot reload

# Production
npm run build        # Build for production
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # Run ESLint
```

## 👥 Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/NaufalPratomo">
        <img src="https://avatars.githubusercontent.com/u/140324988?v=4" width="100px" alt="Muhammad Naufal Pratomo"/><br />
        <sub><b>Muhammad Naufal Pratomo</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/DanendraPassadhi">
        <img src="https://avatars.githubusercontent.com/u/143127813?v=4" width="100px" alt="Danendra Nayaka Passadhi"/><br />
        <sub><b>Danendra Nayaka Passadhi</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Ruphasa">
        <img src="https://avatars.githubusercontent.com/u/143374926?v=4?s=100" width="100px" alt="Rizqi Fauzan"/><br />
        <sub><b>Rizqi Fauzan</b></sub>
      </a>
    </td>
  </tr>
</table>

## 📞 Kontak & Support

- 📧 Email: project.by.webquest@gmail.com
- 📱 Phone: +62 85190069401
- 🐛 Issues: [GitHub Issues](https://github.com/NaufalPratomo/WebQuest_Project/issues)

---

<div align="center">
  Made with ❤️ for better plantation management
  
  ⭐ Star project ini jika berguna!
</div>
