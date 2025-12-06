# Migrasi Struktur Estate → Division

## 📋 Ringkasan Perubahan

Proyek ini telah direfactor dari struktur 3-level menjadi 2-level:

### Struktur Lama

```
Company → Estate → Division → Block
```

### Struktur Baru

```
Company → Division (Estate) → Block
```

**Catatan:** Entity `Estate` secara konseptual sekarang mewakili `Division`. Blok langsung berada di bawah Estate tanpa nested divisions.

---

## ✅ File yang Telah Diupdate

### Backend

1. **`backend/src/models/Estate.js`**

   - ❌ Removed `DivisionSchema`
   - ✅ Changed `EstateSchema.divisions: [DivisionSchema]` → `EstateSchema.blocks: [BlockSchema]`

2. **`backend/src/index.js`**
   - ✅ Updated `PUT /estates/:id` - menerima `blocks` bukan `divisions`
   - ✅ Updated `GET /estates/:id` - return estate dengan blocks langsung
   - ❌ Removed `GET /estates/:id/divisions`
   - ❌ Removed `GET /estates/:id/divisions/:divisionId/blocks`

### Frontend

3. **`src/lib/api.ts`**

   - ✅ Updated `createEstate()` - accept `blocks?: unknown[]`
   - ✅ Updated `updateEstate()` - accept `blocks` in body
   - ❌ Removed `api.divisions()`
   - ❌ Removed `api.blocks()`

4. **`src/pages/master/Locations.tsx`**
   - ✅ **Completely rewritten** - struktur baru tanpa nested divisions
   - Estate type: `{ _id, estate_name, blocks[], status }`
   - Import/Export Excel langsung untuk blocks
   - Tambah Divisi = Tambah Estate baru
   - Edit block directly tanpa division layer

### Migration Script

5. **`backend/scripts/migrate-estate-structure.js`**
   - Script migrasi data otomatis
   - Memindahkan semua `estate.divisions[].blocks` → `estate.blocks[]`

### Backup

6. **`src/pages/master/Locations_BACKUP.tsx`**
   - Backup file lama (bisa dihapus setelah testing selesai)

---

## 🚀 Cara Menjalankan Migrasi

### 1. Backup Database (PENTING!)

```bash
# MongoDB backup
mongodump --db sawitrack --out backup/$(date +%Y%m%d)
```

### 2. Pastikan MongoDB Berjalan

```bash
# Windows (jika menggunakan MongoDB service)
net start MongoDB

# Atau jalankan manual
mongod --dbpath C:\data\db
```

### 3. Jalankan Migration Script

```bash
cd backend
node scripts/migrate-estate-structure.js
```

Output yang diharapkan:

```
🚀 Estate Structure Migration Script
=====================================

🔌 Connecting to MongoDB...
✅ Connected!

📊 Fetching estates with old structure...
Found 3 estates with divisions to migrate

🔄 Starting migration...

Processing: Estate 1 (estate1)
  📦 Division 1: 5 blocks
  📦 Division 2: 3 blocks
  ✨ Total blocks to migrate: 8
  ✅ Successfully migrated!

🎉 Migration completed!
```

### 4. Restart Backend

```bash
cd backend
npm start
```

### 5. Test Frontend

```bash
# Di root directory
npm run dev
```

Buka http://localhost:5173 dan test:

- ✅ List divisi muncul per perusahaan
- ✅ Import Excel per divisi
- ✅ Export Excel/PDF per divisi
- ✅ Edit blok berfungsi
- ✅ Tambah divisi baru
- ✅ Pagination blok

---

## 📊 Struktur Data Baru

### MongoDB Document (Estate Collection)

```javascript
{
  "_id": "divisi1",
  "estate_name": "Divisi 1", // Ini nama divisi
  "blocks": [
    {
      "no_blok": "A1",
      "no_tph": "TPH001",
      "id_blok": "BLK001",
      "luas_blok": 15.5,
      "jumlak_pokok": 200,
      "SPH": 136,
      "jenis_tanah": "Mineral",
      "topografi": "Datar",
      "tahun_": 2018,
      // ... field lainnya
    }
  ],
  "status": "active"
}
```

### Excel Import Format

Tidak ada kolom "Divisi" lagi. File Excel per divisi:

| No Blok | No TPH | ID Blok | Jenis Tanah | Topografi | Luas Tanam | ... |
| ------- | ------ | ------- | ----------- | --------- | ---------- | --- |
| A1      | TPH001 | BLK001  | Mineral     | Datar     | 15.5       | ... |
| A2      | TPH002 | BLK002  | Mineral     | Datar     | 12.3       | ... |

---

## ⚠️ Breaking Changes

### API Changes

❌ **Endpoints yang Dihapus:**

- `GET /api/estates/:id/divisions`
- `GET /api/estates/:id/divisions/:divisionId/blocks`

✅ **Endpoints yang Diubah:**

- `PUT /api/estates/:id` - sekarang menerima `{ blocks: [...] }` bukan `{ divisions: [...] }`
- `GET /api/estates/:id` - return estate dengan `blocks[]` langsung

### Frontend API Client

❌ **Functions yang Dihapus:**

- `api.divisions(estateId)`
- `api.blocks(estateId, divisionId)`

✅ **Functions yang Diubah:**

- `api.createEstate({ _id, estate_name, blocks })` - accept blocks
- `api.updateEstate(id, { blocks })` - accept blocks

### Component Changes

- `Locations.tsx` completely rewritten
- Tidak ada nested division UI lagi
- Estate = Divisi konseptually
- Blocks langsung per estate

---

## 🔄 Rollback Plan (Jika Ada Masalah)

### 1. Restore Database

```bash
mongorestore --db sawitrack backup/YYYYMMDD/sawitrack
```

### 2. Revert Code

```bash
git checkout 05ebdf9  # Commit sebelum migrasi
```

### 3. Atau gunakan backup manual

```bash
# Frontend
cp src/pages/master/Locations_BACKUP.tsx src/pages/master/Locations.tsx

# Backend - revert via git
git checkout HEAD~1 backend/src/models/Estate.js
git checkout HEAD~1 backend/src/index.js
git checkout HEAD~1 src/lib/api.ts
```

---

## 📝 Testing Checklist

Setelah migrasi, test hal berikut:

### Backend API

- [ ] `GET /api/estates` - return all estates dengan blocks
- [ ] `GET /api/estates/:id` - return single estate dengan blocks
- [ ] `PUT /api/estates/:id` - update blocks berhasil
- [ ] `POST /api/estates` - create estate baru dengan blocks

### Frontend

- [ ] Halaman Locations terbuka tanpa error
- [ ] List divisi muncul per perusahaan
- [ ] Tambah divisi baru berhasil
- [ ] Import Excel berhasil (tanpa kolom Divisi)
- [ ] Export Excel format benar (tanpa kolom Divisi)
- [ ] Export PDF format benar
- [ ] Edit blok berhasil
- [ ] Pagination blok berfungsi
- [ ] Search divisi berfungsi
- [ ] Field `no_tph` tersimpan dengan benar

### Data Integrity

- [ ] Jumlah total blok sama sebelum & sesudah migrasi
- [ ] Semua field blok tetap utuh (no_tph, luas_blok, dll)
- [ ] Tidak ada data yang hilang
- [ ] Status estate tetap terjaga

---

## 📞 Troubleshooting

### Error: "divisions does not exist"

✅ **Solusi:** Sudah fixed di `api.ts` dan `Locations.tsx`

### Error: MongoDB connection refused

```bash
# Pastikan MongoDB berjalan
net start MongoDB
# atau
mongod --dbpath C:\data\db
```

### Error: "Cannot read property 'blocks' of undefined"

✅ **Solusi:** Jalankan migration script untuk update struktur data

### Data tidak muncul setelah migrasi

1. Check MongoDB: `db.estates.findOne()` harus punya field `blocks[]`
2. Check backend console untuk error
3. Check browser console untuk error API
4. Restart backend: `npm start`
5. Clear browser cache & reload

---

## 🎉 Selesai!

Semua perubahan sudah diterapkan:

- ✅ Backend model updated
- ✅ Backend API updated
- ✅ Frontend API client updated
- ✅ Frontend UI updated
- ✅ Migration script ready
- ✅ Documentation complete

**Langkah selanjutnya:**

1. Backup database Anda
2. Jalankan migration script (saat MongoDB aktif)
3. Restart backend
4. Test semua fitur
5. Deploy jika semua OK ✨
