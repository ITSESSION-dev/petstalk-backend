const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🐾 Migración v2: avatar, preferencias y estados...');

    await client.query(`
      -- Agregar foto/avatar a pets (base64)
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS avatar_base64 TEXT;

      -- Estados rápidos de la mascota (para "último pensamiento")
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS last_thought TEXT;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS last_thought_at TIMESTAMP;

      -- Estado de actividades del día (para que WhatsApp actualice esto)
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS walked_today BOOLEAN DEFAULT false;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS fed_today BOOLEAN DEFAULT false;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS watered_today BOOLEAN DEFAULT false;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS last_status_reset DATE DEFAULT CURRENT_DATE;

      -- Tabla de preferencias de notificación por mascota
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE UNIQUE,
        notify_walk BOOLEAN DEFAULT true,
        notify_food BOOLEAN DEFAULT true,
        notify_water BOOLEAN DEFAULT true,
        notify_sleep BOOLEAN DEFAULT true,
        notify_vaccine BOOLEAN DEFAULT true,
        notify_pipette BOOLEAN DEFAULT true,
        notify_antiparasitic BOOLEAN DEFAULT true,
        notify_birthday BOOLEAN DEFAULT true,
        notify_heat_cycle BOOLEAN DEFAULT true,
        notify_offers BOOLEAN DEFAULT true,
        walk_reminder_hour INTEGER DEFAULT 18,
        food_reminder_hour INTEGER DEFAULT 20,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Migración v2 completada');
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
