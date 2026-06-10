const pool = require('../db/pool');
const { generatePetMessage } = require('./claudeService');
const { sendWhatsAppMessage } = require('./evolutionService');

/**
 * Orquesta: genera mensaje con Claude y lo envía por WhatsApp
 */
async function sendPetMessage({ petId, ownerId, eventType, extraContext = '' }) {
  // 1. Obtener datos de la mascota y dueño
  const petQuery = await pool.query(
    `SELECT p.*, u.name as owner_name, u.phone as owner_phone
     FROM pets p
     JOIN users u ON p.owner_id = u.id
     WHERE p.id = $1 AND p.active = true`,
    [petId]
  );

  if (petQuery.rows.length === 0) {
    throw new Error(`Mascota ${petId} no encontrada`);
  }

  const row = petQuery.rows[0];
  const pet = {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    personality_tone: row.personality_tone,
    vet_name: row.vet_name
  };
  const owner = {
    id: row.owner_id,
    name: row.owner_name,
    phone: row.owner_phone
  };

  // 2. Generar mensaje con Claude
  console.log(`🤖 Generando mensaje para ${pet.name} (${eventType})...`);
  const messageText = await generatePetMessage({ pet, owner, eventType, extraContext });
  console.log(`📝 Mensaje generado: ${messageText}`);

  // 3. Enviar por WhatsApp
  console.log(`📲 Enviando a ${owner.phone}...`);
  let evolutionResponse = null;
  let status = 'sent';

  try {
    evolutionResponse = await sendWhatsAppMessage(owner.phone, messageText);
  } catch (err) {
    console.error('❌ Error enviando WhatsApp:', err.message);
    status = 'failed';
  }

  // 4. Guardar en log
  await pool.query(
    `INSERT INTO messages_log 
     (pet_id, owner_id, event_type, message_text, whatsapp_phone, status, evolution_message_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      petId,
      ownerId,
      eventType,
      messageText,
      owner.phone,
      status,
      evolutionResponse?.key?.id || null
    ]
  );

  return { message: messageText, status, phone: owner.phone };
}

module.exports = { sendPetMessage };
