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
      `SELECT id, name, category, description, image_url, merk, type, serial_number, no_spmb, no_po, kelengkapan, created_at, updated_at
       FROM assets ORDER BY created_at DESC`,
    );
    const { rows: units } = await pool.query(
      `SELECT id, asset_id, unit_code, is_available, condition, loan_status, created_at, updated_at
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
    serial_number,
    no_spmb,
    no_po,
    kelengkapan,
    image_url,
    units: numUnits = 1,
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

    // ✅ CEK DUPLIKAT 1: kode_aset sudah ada
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

    // ✅ CEK DUPLIKAT 2: kombinasi merk + type + serial_number sudah ada
    if (serial_number) {
      const dupSerial = await client.query(
        `SELECT id, name, kode_aset FROM assets 
         WHERE LOWER(merk) = LOWER($1) 
           AND LOWER(type) = LOWER($2) 
           AND LOWER(serial_number) = LOWER($3)`,
        [merk, type || "", serial_number],
      );
      if (dupSerial.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Aset dengan merk "${merk}", type "${type}", S/N "${serial_number}" sudah ada (${dupSerial.rows[0].kode_aset}). Gunakan form Update Aset untuk menambah unit.`,
        });
      }
    }

    // ✅ CEK DUPLIKAT 3: kombinasi merk + type + no_spmb sudah ada
    if (no_spmb) {
      const dupSpmb = await client.query(
        `SELECT id, name, kode_aset FROM assets 
         WHERE LOWER(merk) = LOWER($1) 
           AND LOWER(type) = LOWER($2) 
           AND LOWER(no_spmb) = LOWER($3)`,
        [merk, type || "", no_spmb],
      );
      if (dupSpmb.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Aset dengan merk "${merk}", type "${type}", No. SPMB "${no_spmb}" sudah ada (${dupSpmb.rows[0].kode_aset}). Gunakan form Update Aset untuk menambah unit.`,
        });
      }
    }

    const name = [merk, type].filter(Boolean).join(" ") || kodeAset;

    const { rows: assetRows } = await client.query(
      `INSERT INTO assets (name, category, merk, type, serial_number, no_spmb, no_po, kelengkapan, image_url, kode_aset)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        name,
        category,
        merk,
        type || null,
        serial_number || null,
        no_spmb || null,
        no_po || null,
        kelengkapan || null,
        image_url || null,
        kodeAset,
      ],
    );
    const assetId = assetRows[0].id;

    // Insert units dengan loan_status
    const unitValues = Array.from({ length: numUnits }, (_, i) => [
      assetId,
      `${kodeAset}-${String(i + 1).padStart(3, "0")}`,
      true,
      "good",
      "tersedia",
    ]);

    if (unitValues.length > 0) {
      const placeholders = unitValues
        .map(
          (_, i) =>
            `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
        )
        .join(",");
      const flatValues = unitValues.flat();
      await client.query(
        `INSERT INTO asset_units (asset_id, unit_code, is_available, condition, loan_status) VALUES ${placeholders}`,
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
    serial_number,
    no_spmb,
    no_po,
    kelengkapan,
    image_url,
    addUnits = 0,
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
      `UPDATE assets SET name = $1, category = $2, merk = $3, type = $4, serial_number = $5, no_spmb = $6, no_po = $7, kelengkapan = $8, image_url = $9, kode_aset = $10, updated_at = NOW() WHERE id = $11`,
      [
        name,
        category,
        merk,
        type || null,
        serial_number || null,
        no_spmb || null,
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
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) as cnt FROM asset_units WHERE asset_id = $1`,
        [id],
      );
      const currentCount = parseInt(countRows[0].cnt, 10);
      const startNum = currentCount + 1;
      const unitValues = Array.from({ length: addUnits }, (_, i) => [
        id,
        `${kodeAset}-${String(startNum + i).padStart(3, "0")}`,
        true,
        "good",
        "tersedia",
      ]);
      const placeholders = unitValues
        .map(
          (_, i) =>
            `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
        )
        .join(",");
      const flatValues = unitValues.flat();
      await client.query(
        `INSERT INTO asset_units (asset_id, unit_code, is_available, condition, loan_status) VALUES ${placeholders}`,
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
  const { condition, is_available } = req.body;

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

    if (condition || is_available !== undefined) {
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
// Tambahkan fungsi ini ke assets.controller.js

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

// Tambahkan function ini ke assets.controller.js

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
