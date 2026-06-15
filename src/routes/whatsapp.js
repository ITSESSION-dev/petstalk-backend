const express = require('express');
const pool = require('../db/pool');
const { adminMiddleware } = require('../middleware/auth');
const { checkInstanceStatus, createPetsTalkInstance, getQRCode, sendWhatsAppMessage, setWebhook, getWebhook } = require('../services/evolutionService');
const { interpretOwnerMessage } = require('../services/intentService');

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

// POST /api/whatsapp/set-webhook - Configura el webhook de mensajes entrantes
// Body opcional: { "url": "https://pets-api.sessian.tech/api/whatsapp/webhook" }
router.post('/set-webhook', adminMiddleware, async (req, res) => {
  try {
    const url = req.body?.url || 'https://pets-api.sessian.tech/api/whatsapp/webhook';
    const result = await setWebhook(url);
    res.json({ success: true, url, result });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// GET /api/whatsapp/get-webhook - Ver configuración actual del webhook
router.get('/get-webhook', adminMiddleware, async (req, res) => {
  try {
    const result = await getWebhook();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// POST /api/whatsapp/webhook - Recibe mensajes entrantes desde Evolution API
// Este endpoint NO usa authMiddleware porque lo llama Evolution API directamente.
router.post('/webhook', async (req, res) => {
  // Respondemos rápido siempre, para que Evolution no reintente.
  res.status(200).json({ received: true });

  try {
    const body = req.body;

    // Evolution API v2 envía eventos con esta forma general:
    // { event: 'messages.upsert', instance: '...', data: { key, message, ... } }
    const event = body.event || body.Event;
    if (event && event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return; // ignoramos otros eventos (ack, presence, etc.)
    }

    const data = body.data || body;
    const messageData = Array.isArray(data) ? data[0] : data;
    if (!messageData) return;

    const key = messageData.key || {};
    // Ignorar mensajes enviados por nosotros mismos (fromMe = true)
    if (key.fromMe) return;

    const remoteJid = key.remoteJid || messageData.remoteJid;
    if (!remoteJid) return;

    // Extraer el texto del mensaje (puede venir en distintos formatos)
    const msg = messageData.message || {};
    const text =
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.ephemeralMessage?.message?.conversation ||
      '';

    if (!text || !text.trim()) return;

    // El número viene como "5491164172248@s.whatsapp.net"
    const phone = remoteJid.split('@')[0];

    console.log(`📩 Mensaje entrante de ${phone}: "${text}"`);

    await processIncomingMessage(phone, text.trim());
  } catch (err) {
    console.error('❌ Error procesando webhook de WhatsApp:', err.message);
  }
});

/**
 * Procesa un mensaje entrante: busca al dueño por teléfono,
 * usa Claude para interpretar la intención, y actualiza
 * el estado de su(s) mascota(s).
 */
async function processIncomingMessage(phone, text) {
  // Buscar al dueño por teléfono (tolerante a formatos con o sin 9)
  const userResult = await pool.query(
    `SELECT id, name, phone FROM users WHERE phone = $1 OR phone = $2`,
    [phone, phone.replace(/^549/, '54')]
  );

  if (userResult.rows.length === 0) {
    console.log(`⚠️ No se encontró usuario con teléfono ${phone}`);
    return;
  }

  const owner = userResult.rows[0];

  // Buscar la mascota activa más reciente del dueño
  const petResult = await pool.query(
    `SELECT * FROM pets WHERE owner_id = $1 AND active = true ORDER BY created_at DESC LIMIT 1`,
    [owner.id]
  );

  if (petResult.rows.length === 0) {
    console.log(`⚠️ El usuario ${owner.name} no tiene mascotas activas`);
    return;
  }

  const pet = petResult.rows[0];

  // Interpretar el mensaje con Claude
  const intent = await interpretOwnerMessage({ messageText: text, petName: pet.name });
  console.log(`🤖 Intención detectada para ${pet.name}:`, intent);

  // Actualizar estados si corresponde
  const updates = [];
  const values = [];
  let idx = 1;

  if (intent.walked) { updates.push(`walked_today = true`); }
  if (intent.fed) { updates.push(`fed_today = true`); }
  if (intent.watered) { updates.push(`watered_today = true`); }

  if (updates.length > 0) {
    await pool.query(
      `UPDATE pets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
      [pet.id]
    );
    console.log(`✅ Estado actualizado para ${pet.name}: ${updates.join(', ')}`);
  }

  // Responder al dueño con un mensaje corto en voz de la mascota
  if (intent.reply) {
    try {
      await sendWhatsAppMessage(owner.phone, intent.reply);
    } catch (err) {
      console.error('❌ Error enviando respuesta de confirmación:', err.message);
    }
  }
}

module.exports = router;
