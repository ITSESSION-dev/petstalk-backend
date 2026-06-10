const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/pets - Listar mascotas del usuario
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pets WHERE owner_id = $1 AND active = true ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pets/:id - Detalle de mascota
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pets WHERE id = $1 AND owner_id = $2 AND active = true`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pets - Crear mascota
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name, species = 'perro', breed, birth_date, weight,
      sex, photo_url, vet_name, vet_phone, personality_tone = 'cariñoso'
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const result = await pool.query(
      `INSERT INTO pets 
       (owner_id, name, species, breed, birth_date, weight, sex, photo_url, vet_name, vet_phone, personality_tone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [req.user.id, name, species, breed, birth_date, weight, sex, photo_url, vet_name, vet_phone, personality_tone]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pets/:id - Actualizar mascota
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      name, species, breed, birth_date, weight,
      sex, photo_url, vet_name, vet_phone, personality_tone
    } = req.body;

    const result = await pool.query(
      `UPDATE pets SET
         name = COALESCE($1, name),
         species = COALESCE($2, species),
         breed = COALESCE($3, breed),
         birth_date = COALESCE($4, birth_date),
         weight = COALESCE($5, weight),
         sex = COALESCE($6, sex),
         photo_url = COALESCE($7, photo_url),
         vet_name = COALESCE($8, vet_name),
         vet_phone = COALESCE($9, vet_phone),
         personality_tone = COALESCE($10, personality_tone),
         updated_at = NOW()
       WHERE id = $11 AND owner_id = $12 AND active = true
       RETURNING *`,
      [name, species, breed, birth_date, weight, sex, photo_url, vet_name, vet_phone, personality_tone, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pets/:id - Desactivar mascota (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE pets SET active = false WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
