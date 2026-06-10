const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🐾 Iniciando migración Pet\'s Talk...');

    await client.query(`
      -- Tabla de usuarios (dueños, veterinarias, comercios)
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','vet','shop')),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Tabla de mascotas
      CREATE TABLE IF NOT EXISTS pets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        species VARCHAR(50) NOT NULL DEFAULT 'perro',
        breed VARCHAR(100),
        birth_date DATE,
        weight DECIMAL(5,2),
        sex VARCHAR(10) CHECK (sex IN ('macho','hembra')),
        photo_url VARCHAR(500),
        vet_name VARCHAR(200),
        vet_phone VARCHAR(50),
        personality_tone VARCHAR(20) DEFAULT 'cariñoso',
        collar_connected BOOLEAN DEFAULT false,
        collar_id VARCHAR(100),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Tabla de agenda (fechas clave)
      CREATE TABLE IF NOT EXISTS agenda_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        -- Tipos: vaccine, antiparasitic, pipette, heat_cycle, vet_visit, birthday, custom
        title VARCHAR(200) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        recurrence VARCHAR(20) DEFAULT 'none',
        -- none, monthly, quarterly, yearly
        reminder_days INTEGER[] DEFAULT '{30,15,7,1}',
        last_reminder_sent DATE,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Tabla de mensajes enviados (historial)
      CREATE TABLE IF NOT EXISTS messages_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pet_id UUID REFERENCES pets(id),
        owner_id UUID NOT NULL REFERENCES users(id),
        event_type VARCHAR(50) NOT NULL,
        message_text TEXT NOT NULL,
        whatsapp_phone VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'sent',
        evolution_message_id VARCHAR(200)
      );

      -- Tabla de triggers manuales (simula el collar en MVP)
      CREATE TABLE IF NOT EXISTS manual_triggers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pet_id UUID NOT NULL REFERENCES pets(id),
        trigger_type VARCHAR(50) NOT NULL,
        -- no_walk, no_food, no_water, insufficient_sleep, custom
        triggered_by UUID REFERENCES users(id),
        triggered_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      );

      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets(owner_id);
      CREATE INDEX IF NOT EXISTS idx_agenda_pet ON agenda_events(pet_id);
      CREATE INDEX IF NOT EXISTS idx_agenda_date ON agenda_events(event_date);
      CREATE INDEX IF NOT EXISTS idx_messages_owner ON messages_log(owner_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sent ON messages_log(sent_at);
    `);

    console.log('✅ Migración completada exitosamente');
    console.log('📋 Tablas creadas: users, pets, agenda_events, messages_log, manual_triggers');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
