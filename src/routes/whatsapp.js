const express = require('express');
const { adminMiddleware } = require('../middleware/auth');
const { checkInstanceStatus, createPetsTalkInstance, getQRCode } = require('../services/evolutionService');

const router = express.Router();

// GET /api/whatsapp/status - Estado de la instancia
router.get('/status', adminMiddleware, async (req, res) => {
  try {
    const status = await checkInstanceStatus();
    res.json(status || { connected: false, message: 'Instancia no encontrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/create-instance - Crear instancia Pet's Talk
router.post('/create-instance', adminMiddleware, async (req, res) => {
  try {
    const result = await createPetsTalkInstance();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/qrcode - Obtener QR para conectar
router.get('/qrcode', adminMiddleware, async (req, res) => {
  try {
    const result = await getQRCode();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
