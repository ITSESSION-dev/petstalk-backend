const cron = require('node-cron');
const pool = require('../db/pool');
const { sendPetMessage } = require('../services/messageService');

/**
 * Inicia los 3 jobs programados:
 * 1. Agenda diaria (9:00 AM ARG) - revisa vacunas, pipetas, cumpleaños, etc.
 * 2. Preferencias por hora (cada hora en punto) - revisa paseo/comida según
 *    las preferencias configuradas por el dueño.
 * 3. Reset diario (medianoche ARG) - reinicia walked_today/fed_today/watered_today
 */
function startAgendaScheduler() {
  // 1. Todos los días a las 9:00 AM ARG (12:00 UTC)
  cron.schedule('0 12 * * *', async () => {
    console.log('⏰ Scheduler agenda iniciado:', new Date().toISOString());
    await checkAndSendReminders();
  }, {
    timezone: 'America/Argentina/Buenos_Aires'
  });

  // 2. Cada hora en punto - revisa preferencias de paseo/comida/agua
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Scheduler de preferencias iniciado:', new Date().toISOString());
    await checkPreferenceReminders();
  }, {
    timezone: 'America/Argentina/Buenos_Aires'
  });

  // 3. Todos los días a las 00:05 ARG - resetea estados diarios
  cron.schedule('5 3 * * *', async () => {
    console.log('🌙 Reset diario de estados iniciado:', new Date().toISOString());
    await resetDailyStatuses();
  }, {
    timezone: 'America/Argentina/Buenos_Aires'
  });

  console.log('✅ Scheduler de agenda activado (9:00 AM ARG)');
  console.log('✅ Scheduler de preferencias activado (cada hora)');
  console.log('✅ Reset diario activado (00:05 ARG)');
}

/**
 * Revisa la agenda y envía recordatorios según días configurados.
 */
async function checkAndSendReminders() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

      if (reminderDays.includes(diffDays) || diffDays === 0) {
        if (event.last_reminder_sent) {
          const lastSent = new Date(event.last_reminder_sent);
          lastSent.setHours(0, 0, 0, 0);
          if (lastSent.getTime() === today.getTime()) {
            continue;
          }
        }

        // Verificar preferencia de notificación según tipo de evento
        const prefsResult = await pool.query(
          `SELECT * FROM notification_preferences WHERE pet_id = $1`,
          [event.pet_id]
        );
        const prefs = prefsResult.rows[0];
        if (prefs && !isEventTypeEnabled(prefs, event.event_type)) {
          continue;
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

/**
 * Mapea tipo de evento de agenda a la columna de preferencia correspondiente.
 */
function isEventTypeEnabled(prefs, eventType) {
  const map = {
    vaccine: 'notify_vaccine',
    pipette: 'notify_pipette',
    antiparasitic: 'notify_antiparasitic',
    birthday: 'notify_birthday',
    heat_cycle: 'notify_heat_cycle',
    vet_visit: 'notify_vaccine', // sin categoría propia, usa la de vacunas/salud
  };
  const key = map[eventType];
  if (!key) return true; // si no está mapeado, no bloqueamos
  return prefs[key] !== false;
}

/**
 * Revisa cada mascota activa y, según sus preferencias y la hora configurada,
 * envía un recordatorio si todavía no salió a pasear o no comió.
 * Corre cada hora; solo dispara si la hora actual coincide con la configurada
 * y la actividad sigue pendiente.
 */
async function checkPreferenceReminders() {
  try {
    const now = new Date();
    // Hora actual en Argentina (UTC-3)
    const argHour = (now.getUTCHours() - 3 + 24) % 24;

    const result = await pool.query(`
      SELECT 
        p.id as pet_id, p.name, p.owner_id, p.walked_today, p.fed_today, p.watered_today,
        np.notify_walk, np.notify_food, np.notify_water,
        np.walk_reminder_hour, np.food_reminder_hour
      FROM pets p
      LEFT JOIN notification_preferences np ON np.pet_id = p.id
      WHERE p.active = true
    `);

    let sentCount = 0;

    for (const pet of result.rows) {
      // Paseo
      if (pet.notify_walk !== false && !pet.walked_today) {
        const reminderHour = pet.walk_reminder_hour ?? 18;
        if (argHour === reminderHour) {
          await sendPetMessage({
            petId: pet.pet_id,
            ownerId: pet.owner_id,
            eventType: 'no_walk'
          });
          sentCount++;
        }
      }

      // Comida
      if (pet.notify_food !== false && !pet.fed_today) {
        const reminderHour = pet.food_reminder_hour ?? 20;
        if (argHour === reminderHour) {
          await sendPetMessage({
            petId: pet.pet_id,
            ownerId: pet.owner_id,
            eventType: 'no_food'
          });
          sentCount++;
        }
      }
    }

    console.log(`✅ Scheduler de preferencias completado: ${sentCount} mensajes enviados`);
  } catch (err) {
    console.error('❌ Error en scheduler de preferencias:', err.message);
  }
}

/**
 * Resetea walked_today, fed_today, watered_today a false para todas las mascotas.
 * Corre una vez por día (madrugada).
 */
async function resetDailyStatuses() {
  try {
    const result = await pool.query(`
      UPDATE pets 
      SET walked_today = false, fed_today = false, watered_today = false, last_status_reset = CURRENT_DATE
      WHERE active = true
      RETURNING id
    `);
    console.log(`🌙 Reset diario completado: ${result.rows.length} mascotas reiniciadas`);
  } catch (err) {
    console.error('❌ Error en reset diario:', err.message);
  }
}

module.exports = { startAgendaScheduler, checkAndSendReminders, checkPreferenceReminders, resetDailyStatuses };
