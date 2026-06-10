const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function adminMiddleware(req, res, next) {
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };
