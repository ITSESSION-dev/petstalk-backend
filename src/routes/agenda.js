const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/agenda/:petId - Eventos de la mascota
router.get('/:petId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM agenda_events 
       WHERE pet_id = $1 AND owner_id = $2 AND active = true
       ORDER BY event_date ASC`,
      [req.params.petId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agenda - Crear evento
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      pet_id, event_type, title, description,
      event_date, recurrence = 'none', reminder_days = [30, 15, 7, 1]
    } = req.body;

    if (!pet_id || !event_type || !title || !event_date) {
      return res.status(400).json({ error: 'pet_id, event_type, title y event_date son requeridos' });
    }

    // Verificar que la mascota pertenece al usuario
    const petCheck = await pool.query(
      'SELECT id FROM pets WHERE id = $1 AND owner_id = $2',
      [pet_id, req.user.id]
    );
    if (petCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Mascota no autorizada' });
    }

    const result = await pool.query(
      `INSERT INTO agenda_events 
       (pet_id, owner_id, event_type, title, description, event_date, recurrence, reminder_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [pet_id, req.user.id, event_type, title, description, event_date, recurrence, reminder_days]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agenda/:id - Desactivar evento
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE agenda_events SET active = false WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
