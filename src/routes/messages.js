const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendPetMessage } = require('../services/messageService');
const { checkAndSendReminders } = require('../jobs/agendaScheduler');

const router = express.Router();

// POST /api/messages/trigger - Trigger manual (simula eventos del collar)
router.post('/trigger', authMiddleware, async (req, res) => {
  try {
    const { pet_id, trigger_type, extra_context = '' } = req.body;

    if (!pet_id || !trigger_type) {
      return res.status(400).json({ error: 'pet_id y trigger_type son requeridos' });
    }

    const validTriggers = [
      'no_walk', 'no_food', 'no_water', 'insufficient_sleep',
      'heat_cycle', 'birthday', 'commercial_offer', 'custom'
    ];

    if (!validTriggers.includes(trigger_type)) {
      return res.status(400).json({ error: `trigger_type inválido. Opciones: ${validTriggers.join(', ')}` });
    }

    // Registrar el trigger manual
    await pool.query(
      `INSERT INTO manual_triggers (pet_id, trigger_type, triggered_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [pet_id, trigger_type, req.user.id, extra_context]
    );

    // Generar y enviar el mensaje
    const result = await sendPetMessage({
      petId: pet_id,
      ownerId: req.user.id,
      eventType: trigger_type,
      extraContext: extra_context
    });

    res.json({
      success: true,
      message: result.message,
      status: result.status,
      phone: result.phone
    });
  } catch (err) {
    console.error('Trigger error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/history/:petId - Historial de mensajes
router.get('/history/:petId', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await pool.query(
      `SELECT * FROM messages_log 
       WHERE pet_id = $1 AND owner_id = $2
       ORDER BY sent_at DESC
       LIMIT $3`,
      [req.params.petId, req.user.id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages/run-scheduler - Forzar ejecución del scheduler (admin)
router.post('/run-scheduler', adminMiddleware, async (req, res) => {
  try {
    console.log('⚡ Scheduler ejecutado manualmente por admin');
    await checkAndSendReminders();
    res.json({ success: true, message: 'Scheduler ejecutado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
