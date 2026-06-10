const cron = require('node-cron');
const pool = require('../db/pool');
const { sendPetMessage } = require('../services/messageService');

/**
 * Revisa la agenda y envía recordatorios según días configurados
 * Corre todos los días a las 9:00 AM (hora Argentina)
 */
function startAgendaScheduler() {
  // Todos los días a las 9:00 AM UTC-3 (12:00 UTC)
  cron.schedule('0 12 * * *', async () => {
    console.log('⏰ Scheduler agenda iniciado:', new Date().toISOString());
    await checkAndSendReminders();
  }, {
    timezone: 'America/Argentina/Buenos_Aires'
  });

  console.log('✅ Scheduler de agenda activado (9:00 AM ARG)');
}

async function checkAndSendReminders() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Traer todos los eventos activos con sus mascotas
    const eventsQuery = await pool.query(`
      SELECT 
        ae.*,
        p.name as pet_name,
        p.owner_id,
        u.phone as owner_phone
      FROM agenda_events ae
      JOIN pets p ON ae.pet_id = p.id
      JOIN users u ON ae.owner_id = u.id
      WHERE ae.active = true
        AND p.active = true
    `);

    let sentCount = 0;

    for (const event of eventsQuery.rows) {
      const eventDate = new Date(event.event_date);
      eventDate.setHours(0, 0, 0, 0);

      const diffDays = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));
      const reminderDays = event.reminder_days || [30, 15, 7, 1];

      // Verificar si hoy corresponde enviar un recordatorio
      if (reminderDays.includes(diffDays) || diffDays === 0) {
        // Verificar que no enviamos hoy ya
        if (event.last_reminder_sent) {
          const lastSent = new Date(event.last_reminder_sent);
          lastSent.setHours(0, 0, 0, 0);
          if (lastSent.getTime() === today.getTime()) {
            continue; // Ya enviamos hoy
          }
        }

        let extraContext = '';
        if (diffDays > 0) {
          extraContext = `Faltan ${diffDays} días para: ${event.title}`;
        } else if (diffDays === 0) {
          extraContext = `¡Hoy es el día! Evento: ${event.title}`;
        }

        console.log(`📅 Enviando recordatorio: ${event.pet_name} - ${event.event_type} - en ${diffDays} días`);

        try {
          await sendPetMessage({
            petId: event.pet_id,
            ownerId: event.owner_id,
            eventType: event.event_type + '_reminder',
            extraContext
          });

          // Actualizar último recordatorio enviado
          await pool.query(
            `UPDATE agenda_events SET last_reminder_sent = $1 WHERE id = $2`,
            [today, event.id]
          );

          sentCount++;
        } catch (err) {
          console.error(`❌ Error en recordatorio ${event.id}:`, err.message);
        }
      }
    }

    console.log(`✅ Scheduler completado: ${sentCount} recordatorios enviados`);
  } catch (err) {
    console.error('❌ Error en scheduler de agenda:', err.message);
  }
}

module.exports = { startAgendaScheduler, checkAndSendReminders };
