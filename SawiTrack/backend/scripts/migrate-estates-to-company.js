/**
 * Script untuk migrasi estate yang sudah ada ke company
 *
 * Cara menjalankan:
 * 1. Via Browser Console (F12):
 *    - Copy paste kode di fungsi migrateEstates() ke console
 *    - Jalankan migrateEstates()
 *
 * 2. Via Node.js:
 *    - cd backend
 *    - node scripts/migrate-estates-to-company.js
 */

// ===== UNTUK BROWSER CONSOLE =====
async function migrateEstates() {
  console.log("🚀 Memulai migrasi estate ke company...");

  try {
    // 1. Get all companies
    const companiesRes = await fetch("http://localhost:5000/api/companies");
    const companies = await companiesRes.json();

    if (!Array.isArray(companies) || companies.length === 0) {
      console.error("❌ Tidak ada company! Buat company terlebih dahulu.");
      console.log("Gunakan kode ini untuk membuat company:");
      console.log(`
fetch('http://localhost:5000/api/companies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_name: "PT. SawiTrack International",
    address: "Jl. Perkebunan Sawit No. 1, Kalimantan"
  })
}).then(r => r.json()).then(console.log);
      `);
      return;
    }

    const firstCompany = companies[0];
    console.log(`📋 Company yang akan digunakan: ${firstCompany.company_name}`);

    // 2. Get all estates
    const estatesRes = await fetch("http://localhost:5000/api/estates");
    const estates = await estatesRes.json();

    if (!Array.isArray(estates) || estates.length === 0) {
      console.log("ℹ️  Tidak ada estate untuk dimigrasi");
      return;
    }

    const estateIds = estates.map((e) => e._id);
    console.log(`📦 Ditemukan ${estateIds.length} estate:`, estateIds);

    // 3. Update company dengan semua estate IDs
    const updateRes = await fetch(
      `http://localhost:5000/api/companies/${firstCompany._id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estates: estateIds,
        }),
      }
    );

    if (!updateRes.ok) {
      const error = await updateRes.text();
      throw new Error(error);
    }

    const result = await updateRes.json();
    console.log("✅ Migrasi berhasil!");
    console.log(
      `📊 ${estateIds.length} estate berhasil dihubungkan dengan ${firstCompany.company_name}`
    );
    console.log("Detail:", result);

    // 4. Refresh halaman
    console.log("🔄 Merefresh halaman dalam 2 detik...");
    setTimeout(() => window.location.reload(), 2000);
  } catch (error) {
    console.error("❌ Error saat migrasi:", error);
  }
}

// ===== UNTUK NODE.JS =====
if (typeof module !== "undefined" && module.exports) {
  const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
  const dotenv = require("dotenv");
  const path = require("path");

  dotenv.config({ path: path.resolve(__dirname, "../../.env") });

  const API_BASE = process.env.VITE_API_BASE_URL || "http://localhost:5000/api";

  async function migrateEstatesNode() {
    console.log("🚀 Memulai migrasi estate ke company...");

    try {
      // 1. Get all companies
      const companiesRes = await fetch(`${API_BASE}/companies`);
      const companies = await companiesRes.json();

      if (!Array.isArray(companies) || companies.length === 0) {
        console.error("❌ Tidak ada company! Buat company terlebih dahulu.");
        return;
      }

      const firstCompany = companies[0];
      console.log(
        `📋 Company yang akan digunakan: ${firstCompany.company_name}`
      );

      // 2. Get all estates
      const estatesRes = await fetch(`${API_BASE}/estates`);
      const estates = await estatesRes.json();

      if (!Array.isArray(estates) || estates.length === 0) {
        console.log("ℹ️  Tidak ada estate untuk dimigrasi");
        return;
      }

      const estateIds = estates.map((e) => e._id);
      console.log(`📦 Ditemukan ${estateIds.length} estate:`, estateIds);

      // 3. Update company dengan semua estate IDs
      const updateRes = await fetch(
        `${API_BASE}/companies/${firstCompany._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estates: estateIds,
          }),
        }
      );

      if (!updateRes.ok) {
        const error = await updateRes.text();
        throw new Error(error);
      }

      const result = await updateRes.json();
      console.log("✅ Migrasi berhasil!");
      console.log(
        `📊 ${estateIds.length} estate berhasil dihubungkan dengan ${firstCompany.company_name}`
      );
      console.log("Detail:", result);
    } catch (error) {
      console.error("❌ Error saat migrasi:", error);
    }
  }

  // Run jika dipanggil langsung
  if (require.main === module) {
    migrateEstatesNode();
  }

  module.exports = { migrateEstatesNode };
}

// Export untuk browser
if (typeof window !== "undefined") {
  window.migrateEstates = migrateEstates;
  console.log("✅ Script loaded! Jalankan: migrateEstates()");
}
