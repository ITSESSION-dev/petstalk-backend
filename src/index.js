require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startAgendaScheduler } = require('./jobs/agendaScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : '*',
  credentials: true
}));
// Límite aumentado para permitir avatares en base64
app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: "Pet's Talk API",
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pets', require('./routes/pets'));
app.use('/api/agenda', require('./routes/agenda'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🐾 Pet's Talk API corriendo en puerto ${PORT}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);

  // Iniciar scheduler de agenda
  startAgendaScheduler();
});

module.exports = app;
