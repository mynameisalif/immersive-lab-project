// Simpan file ini sebagai debug_test.js di folder backend
// Jalankan dengan: node debug_test.js

require("dotenv").config();
const pool = require("./src/config/db");

async function debugTest() {
  console.log("\n========== DEBUG TEST ==========");
  console.log("DB Config:", {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
      ? "***" + process.env.DB_PASSWORD.slice(-3)
      : "KOSONG",
  });

  try {
    // Test 1: Koneksi DB
    console.log("\n[TEST 1] Cek koneksi database...");
    const conn = await pool.query("SELECT NOW() as time");
    console.log("✅ Koneksi OK! Waktu server:", conn.rows[0].time);

    // Test 2: Cek tabel profiles
    console.log("\n[TEST 2] Cek tabel profiles...");
    const tables = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' 
      ORDER BY ordinal_position
    `);
    console.log("✅ Kolom tabel profiles:");
    tables.rows.forEach((r) =>
      console.log(`   - ${r.column_name} (${r.data_type})`),
    );

    // Test 3: Cek kolom password_hash ada
    console.log("\n[TEST 3] Cek kolom password_hash...");
    const pwCol = tables.rows.find((r) => r.column_name === "password_hash");
    if (pwCol) {
      console.log("✅ Kolom password_hash ADA!");
    } else {
      console.log("❌ Kolom password_hash TIDAK ADA! Ini penyebab error!");
      console.log("   Solusi: Jalankan query di pgAdmin:");
      console.log("   ALTER TABLE profiles ADD COLUMN password_hash TEXT;");
    }

    // Test 4: Cek tabel user_roles
    console.log("\n[TEST 4] Cek tabel user_roles...");
    const roles = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'user_roles'
    `);
    console.log(
      "✅ Kolom tabel user_roles:",
      roles.rows.map((r) => r.column_name).join(", "),
    );

    // Test 5: Cek enum app_role
    console.log("\n[TEST 5] Cek enum app_role...");
    const enums = await pool.query(`
      SELECT e.enumlabel 
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'app_role'
    `);
    if (enums.rows.length > 0) {
      console.log(
        "✅ Enum app_role:",
        enums.rows.map((r) => r.enumlabel).join(", "),
      );
    } else {
      console.log("❌ Enum app_role TIDAK ADA!");
    }

    // Test 6: Insert test sederhana
    console.log("\n[TEST 6] Coba insert ke profiles...");
    try {
      const testInsert = await pool.query(`
        INSERT INTO profiles (email, full_name, password_hash)
        VALUES ('debug_test@test.com', 'Debug Test', 'test_hash')
        RETURNING id, email, full_name
      `);
      console.log("✅ Insert berhasil!", testInsert.rows[0]);

      // Hapus data test
      await pool.query(
        `DELETE FROM profiles WHERE email = 'debug_test@test.com'`,
      );
      console.log("✅ Data test dihapus");
    } catch (insertErr) {
      console.log("❌ Insert gagal! Error:", insertErr.message);
    }

    console.log("\n================================");
    console.log("DEBUG SELESAI!");
    console.log("================================\n");
  } catch (err) {
    console.error("\n❌ ERROR:", err.message);
    console.error("Detail:", err);
  } finally {
    await pool.end();
  }
}

debugTest();
