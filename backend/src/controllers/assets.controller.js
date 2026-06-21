const pool = require("../config/db");
const VALID_ASSET_CATEGORIES = [
  "Battery",
  "Camera",
  "Lighting",
  "Lightstand",
  "Tripod",
  "Clip On",
  "Speaker",
  "Adaptor",
  "Memory Card",
  "Cable",
  "Others",
];

exports.getAllAssets = async (req, res) => {
  try {
    const { rows: assets } = await pool.query(
      `SELECT id, name, category, description, image_url, merk, type, no_pr, no_po, kelengkapan, created_at, updated_at
       FROM assets ORDER BY created_at DESC`,
    );
    const { rows: units } = await pool.query(
      `SELECT id, asset_id, unit_code, serial_number, is_available, condition, loan_status, created_at, updated_at
       FROM asset_units ORDER BY unit_code`,
    );
    res.json({ data: { assets, units } });
  } catch (err) {
    console.error("[ERROR] getAllAssets error:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.createAsset = async (req, res) => {
  const {
    kode_aset_num,
    category,
    merk,
    type,
    no_pr,
    no_po,
    kelengkapan,
    image_url,
    units: numUnits = 1,
    unitSerialNumbers = [], // Array of S/N untuk setiap unit
  } = req.body;

  // Validasi field wajib
  if (!kode_aset_num || !category || !merk) {
    return res.status(400).json({
      message: "kode_aset_num, category, merk wajib diisi",
    });
  }

  // Validasi kategori
  if (!VALID_ASSET_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: "Kategori tidak valid" });
  }

  const paddedNum = String(kode_aset_num).padStart(4, "0");
  const kodeAset = `MNP/IPRO/${paddedNum}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ✅ CEK DUPLIKAT: kode_aset sudah ada
    const dupKode = await client.query(
      `SELECT id, name FROM assets WHERE kode_aset = $1`,
      [kodeAset],
    );
    if (dupKode.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Kode aset ${kodeAset} sudah digunakan oleh aset "${dupKode.rows[0].name}". Gunakan form Update Aset untuk menambah unit.`,
      });
    }

    const name = [merk, type].filter(Boolean).join(" ") || kodeAset;

    const { rows: assetRows } = await client.query(
      `INSERT INTO assets (name, category, merk, type, no_pr, no_po, kelengkapan, image_url, kode_aset)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        name,
        category,
        merk,
        type || null,
        no_pr || null,
        no_po || null,
        kelengkapan || null,
        image_url || null,
        kodeAset,
      ],
    );
    const assetId = assetRows[0].id;

    // 🔢 Find next available sequential unit code number
    const { rows: maxRows } = await client.query(
      `SELECT MAX(CAST(SUBSTRING(unit_code, 10) AS INTEGER)) as max_num 
       FROM asset_units 
       WHERE unit_code LIKE 'MNP/IPRO/%'`,
    );
    const maxNum =
      parseInt(maxRows[0]?.max_num || paddedNum) || parseInt(paddedNum);
    const startNum = maxNum + 1;

    // Insert units dengan unit_code sequential (MNP/IPRO/0067, 0068, 0069, ...)
    const unitValues = Array.from({ length: numUnits }, (_, i) => [
      assetId,
      `MNP/IPRO/${String(startNum + i).padStart(4, "0")}`,
      unitSerialNumbers[i] || null, // S/N bisa berbeda per unit
      true,
      "good",
      "tersedia",
    ]);

    if (unitValues.length > 0) {
      const placeholders = unitValues
        .map(
          (_, i) =>
            `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`,
        )
        .join(",");
      const flatValues = unitValues.flat();
      await client.query(
        `INSERT INTO asset_units (asset_id, unit_code, serial_number, is_available, condition, loan_status) VALUES ${placeholders}`,
        flatValues,
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      message: "Aset berhasil ditambahkan",
      data: { asset_id: assetId, kode_aset: kodeAset, units_created: numUnits },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[ERROR] createAsset error:", err.message);
    res.status(500).json({ message: "Gagal membuat aset", error: err.message });
  } finally {
    client.release();
  }
};

exports.updateAsset = async (req, res) => {
  const { id } = req.params;
  const {
    kode_aset_num,
    category,
    merk,
    type,
    no_pr,
    no_po,
    kelengkapan,
    image_url,
    addUnits = 0,
    additionalSerialNumbers = [], // Array of S/N untuk unit baru
  } = req.body;

  if (!kode_aset_num)
    return res.status(400).json({ message: "kode_aset_num wajib diisi" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const paddedNum = String(kode_aset_num).padStart(4, "0");
    const kodeAset = `MNP/IPRO/${paddedNum}`;
    const name = [merk, type].filter(Boolean).join(" ") || kodeAset;

    const { rowCount } = await client.query(
      `UPDATE assets SET name = $1, category = $2, merk = $3, type = $4, no_pr = $5, no_po = $6, kelengkapan = $7, image_url = $8, kode_aset = $9, updated_at = NOW() WHERE id = $10`,
      [
        name,
        category,
        merk,
        type || null,
        no_pr || null,
        no_po || null,
        kelengkapan || null,
        image_url || null,
        kodeAset,
        id,
      ],
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Aset tidak ditemukan" });
    }

    if (addUnits > 0) {
      // 🔢 Find next available sequential unit code number
      const { rows: maxRows } = await client.query(
        `SELECT MAX(CAST(SUBSTRING(unit_code, 10) AS INTEGER)) as max_num 
         FROM asset_units 
         WHERE unit_code LIKE 'MNP/IPRO/%'`,
      );
      const maxNum =
        parseInt(maxRows[0]?.max_num || paddedNum) || parseInt(paddedNum);
      const startNum = maxNum + 1;

      const unitValues = Array.from({ length: addUnits }, (_, i) => [
        id,
        `MNP/IPRO/${String(startNum + i).padStart(4, "0")}`,
        additionalSerialNumbers[i] || null, // S/N bisa berbeda per unit
        true,
        "good",
        "tersedia",
      ]);

      const placeholders = unitValues
        .map(
          (_, i) =>
            `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`,
        )
        .join(",");
      const flatValues = unitValues.flat();
      await client.query(
        `INSERT INTO asset_units (asset_id, unit_code, serial_number, is_available, condition, loan_status) VALUES ${placeholders}`,
        flatValues,
      );
    }
    await client.query("COMMIT");
    res.json({
      message: "Aset berhasil diperbarui",
      data: { asset_id: id, units_added: addUnits },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[ERROR] updateAsset error:", err.message);
    res
      .status(500)
      .json({ message: "Gagal memperbarui aset", error: err.message });
  } finally {
    client.release();
  }
  if (!VALID_ASSET_CATEGORIES.includes(category))
    return res.status(400).json({ message: "Kategori tidak valid" });
};

exports.deleteAsset = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM asset_units WHERE asset_id = $1`, [id]);
    const { rowCount } = await client.query(
      `DELETE FROM assets WHERE id = $1`,
      [id],
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Aset tidak ditemukan" });
    }
    await client.query("COMMIT");
    res.json({ message: "Aset berhasil dihapus" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[ERROR] deleteAsset error:", err.message);
    res
      .status(500)
      .json({ message: "Gagal menghapus aset", error: err.message });
  } finally {
    client.release();
  }
};

exports.updateUnit = async (req, res) => {
  const { unitId } = req.params;
  const { condition, is_available, serial_number } = req.body;

  const validConditions = ["good", "minor", "major"];

  if (condition && !validConditions.includes(condition)) {
    return res.status(400).json({
      message: "condition harus: good, minor, atau major",
    });
  }

  try {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (condition) {
      updates.push(`condition = $${paramIndex++}`);
      values.push(condition);
    }

    if (is_available !== undefined) {
      updates.push(`is_available = $${paramIndex++}`);
      values.push(is_available);
    }

    if (serial_number !== undefined) {
      updates.push(`serial_number = $${paramIndex++}`);
      values.push(serial_number || null);
    }

    if (
      condition ||
      is_available !== undefined ||
      serial_number !== undefined
    ) {
      updates.push(`updated_at = NOW()`);
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ message: "Tidak ada data untuk diperbarui" });
    }

    values.push(unitId);

    const { rowCount } = await pool.query(
      `UPDATE asset_units SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values,
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Unit tidak ditemukan" });
    }

    res.json({ message: "Unit berhasil diperbarui" });
  } catch (err) {
    console.error("[ERROR] updateUnit error:", err.message);
    res
      .status(500)
      .json({ message: "Gagal memperbarui unit", error: err.message });
  }
};

exports.deleteUnit = async (req, res) => {
  const { unitId } = req.params;
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM asset_units WHERE id = $1`,
      [unitId],
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: "Unit tidak ditemukan" });
    }
    res.json({ message: "Unit berhasil dihapus" });
  } catch (err) {
    console.error("[ERROR] deleteUnit error:", err.message);
    res
      .status(500)
      .json({ message: "Gagal menghapus unit", error: err.message });
  }
};

exports.getAssetStats = async (req, res) => {
  try {
    // Total aset
    const { rows: assetRows } = await pool.query(
      `SELECT COUNT(*) as count FROM assets`,
    );
    const totalAsset = parseInt(assetRows[0].count, 10);

    // Stok yang menipis (total unit ≤ 1)
    const { rows: stokRows } = await pool.query(
      `SELECT a.id, a.name, COUNT(au.id) as total
       FROM assets a
       LEFT JOIN asset_units au ON a.id = au.asset_id
       GROUP BY a.id, a.name
       HAVING COUNT(au.id) <= 1`,
    );
    const stokMenipis = stokRows.length;

    res.json({
      data: {
        totalAsset,
        stokMenipis,
      },
    });
  } catch (err) {
    console.error("getAssetStats error:", err);
    res.status(500).json({ message: "Gagal fetch stats aset" });
  }
};

exports.getAvailableAssets = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        a.id as asset_id,
        a.name,
        a.category,
        a.merk,
        a.type,
        COUNT(au.id) FILTER (
          WHERE au.condition = 'good' 
          AND au.loan_status = 'tersedia'
        ) as available_units
      FROM assets a
      LEFT JOIN asset_units au ON a.id = au.asset_id
      GROUP BY a.id, a.name, a.category, a.merk, a.type
      HAVING COUNT(au.id) FILTER (
        WHERE au.condition = 'good' 
        AND au.loan_status = 'tersedia'
      ) > 0
      ORDER BY a.merk, a.type`,
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("getAvailableAssets error:", err.message);
    res.status(500).json({ message: "Gagal fetch aset tersedia" });
  }
};
