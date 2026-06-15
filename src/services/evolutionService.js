const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

const evolutionClient = axios.create({
  baseURL: EVOLUTION_URL,
  headers: {
    'apikey': EVOLUTION_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

/**
 * Envía un mensaje de texto por WhatsApp
 * @param {string} phone - Número en formato 5491164172248 (sin +)
 * @param {string} message - Texto del mensaje
 */
async function sendWhatsAppMessage(phone, message) {
  // Limpiar el número: solo dígitos
  const cleanPhone = phone.replace(/\D/g, '');

  const payload = {
    number: cleanPhone,
    text: message
  };

  const response = await evolutionClient.post(
    `/message/sendText/${EVOLUTION_INSTANCE}`,
    payload
  );

  return response.data;
}

/**
 * Verifica el estado de la instancia de WhatsApp
 */
async function checkInstanceStatus() {
  const response = await evolutionClient.get(
    `/instance/fetchInstances`
  );
  const instances = response.data;
  const instance = instances.find(i => i.name === EVOLUTION_INSTANCE);
  return instance || null;
}

/**
 * Crea una nueva instancia en Evolution API para Pet's Talk
 */
async function createPetsTalkInstance() {
  const payload = {
    instanceName: EVOLUTION_INSTANCE,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true
  };

  const response = await evolutionClient.post('/instance/create', payload);
  return response.data;
}

/**
 * Obtiene el QR code para conectar WhatsApp
 */
async function getQRCode() {
  const response = await evolutionClient.get(
    `/instance/connect/${EVOLUTION_INSTANCE}`
  );
  return response.data;
}

/**
 * Configura el webhook de la instancia para que Evolution API
 * envíe los mensajes entrantes (messages.upsert) a nuestro backend.
 * @param {string} webhookUrl - URL pública completa, ej: https://pets-api.sessian.tech/api/whatsapp/webhook
 */
async function setWebhook(webhookUrl) {
  const payload = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: ['MESSAGES_UPSERT']
    }
  };

  const response = await evolutionClient.post(
    `/webhook/set/${EVOLUTION_INSTANCE}`,
    payload
  );
  return response.data;
}

/**
 * Obtiene la configuración actual del webhook de la instancia.
 */
async function getWebhook() {
  const response = await evolutionClient.get(
    `/webhook/find/${EVOLUTION_INSTANCE}`
  );
  return response.data;
}

module.exports = {
  sendWhatsAppMessage,
  checkInstanceStatus,
  createPetsTalkInstance,
  getQRCode,
  setWebhook,
  getWebhook
};
