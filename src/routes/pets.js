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
      sex, photo_url, avatar_base64, vet_name, vet_phone, personality_tone = 'cariñoso'
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const result = await pool.query(
      `INSERT INTO pets 
       (owner_id, name, species, breed, birth_date, weight, sex, photo_url, avatar_base64, vet_name, vet_phone, personality_tone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [req.user.id, name, species, breed, birth_date, weight, sex, photo_url, avatar_base64, vet_name, vet_phone, personality_tone]
    );

    const pet = result.rows[0];

    // Crear preferencias por defecto automáticamente
    await pool.query(
      `INSERT INTO notification_preferences (pet_id) VALUES ($1)
       ON CONFLICT (pet_id) DO NOTHING`,
      [pet.id]
    );

    res.status(201).json(pet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pets/:id - Actualizar mascota
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      name, species, breed, birth_date, weight,
      sex, photo_url, avatar_base64, vet_name, vet_phone, personality_tone
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
         avatar_base64 = COALESCE($8, avatar_base64),
         vet_name = COALESCE($9, vet_name),
         vet_phone = COALESCE($10, vet_phone),
         personality_tone = COALESCE($11, personality_tone),
         updated_at = NOW()
       WHERE id = $12 AND owner_id = $13 AND active = true
       RETURNING *`,
      [name, species, breed, birth_date, weight, sex, photo_url, avatar_base64, vet_name, vet_phone, personality_tone, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pets/:id/preferences - Obtener preferencias de notificación
router.get('/:id/preferences', authMiddleware, async (req, res) => {
  try {
    const petCheck = await pool.query(
      'SELECT id FROM pets WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    );
    if (petCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Mascota no autorizada' });
    }

    let result = await pool.query(
      `SELECT * FROM notification_preferences WHERE pet_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      // Crear preferencias por defecto si no existen
      result = await pool.query(
        `INSERT INTO notification_preferences (pet_id) VALUES ($1) RETURNING *`,
        [req.params.id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pets/:id/preferences - Actualizar preferencias de notificación
router.put('/:id/preferences', authMiddleware, async (req, res) => {
  try {
    const petCheck = await pool.query(
      'SELECT id FROM pets WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    );
    if (petCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Mascota no autorizada' });
    }

    const {
      notify_walk, notify_food, notify_water, notify_sleep,
      notify_vaccine, notify_pipette, notify_antiparasitic,
      notify_birthday, notify_heat_cycle, notify_offers,
      walk_reminder_hour, food_reminder_hour
    } = req.body;

    const result = await pool.query(
      `INSERT INTO notification_preferences 
        (pet_id, notify_walk, notify_food, notify_water, notify_sleep, notify_vaccine, 
         notify_pipette, notify_antiparasitic, notify_birthday, notify_heat_cycle, notify_offers,
         walk_reminder_hour, food_reminder_hour, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (pet_id) DO UPDATE SET
         notify_walk = $2, notify_food = $3, notify_water = $4, notify_sleep = $5,
         notify_vaccine = $6, notify_pipette = $7, notify_antiparasitic = $8,
         notify_birthday = $9, notify_heat_cycle = $10, notify_offers = $11,
         walk_reminder_hour = $12, food_reminder_hour = $13, updated_at = NOW()
       RETURNING *`,
      [req.params.id, notify_walk, notify_food, notify_water, notify_sleep,
       notify_vaccine, notify_pipette, notify_antiparasitic, notify_birthday,
       notify_heat_cycle, notify_offers, walk_reminder_hour || 18, food_reminder_hour || 20]
    );

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
