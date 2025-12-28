import logger from '../../logger.js';
import * as tokenService from '../services/tokenService.js';

const openPaths = [
  '/api/v1/docs/',
  '/api/v1/health',
  '/api/v1/about',
  '/api/v1/changelog',
  '/api/v1/version',
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout', // Logout público (RFC 7009 - best effort revocation)
  '/api/v1/auth/validate-token', // Para que el gateway pueda validar tokens
  '/api/v1/auth/forgot-password', // Solicitar reset de contraseña
  '/api/v1/auth/reset-password', // Restablecer contraseña con token
  '/api/v1/auth/verify-email', // Verificar email con token
  '/api/v1/auth/resend-verification', // Reenviar correo de verificación
  '/api/v1/profile/internal/', // Rutas internas protegidas por API Key, no JWT
];

const verifyToken = async (req, res, next) => {
  // Verificar rutas abiertas con coincidencia exacta o prefijo
  const isOpenPath = openPaths.some((path) => {
    if (path.endsWith('/')) {
      return req.path.startsWith(path);
    }
    return req.path === path;
  });

  if (isOpenPath) {
    return next();
  }

  if (!req.path.startsWith('/api/v')) {
    return res
      .status(400)
      .json({ message: 'You must specify the API version, e.g. /api/v1/...' });
  }

  // Prioridad 1: Headers del Gateway (cuando viene a través del gateway)
  const gatewayAuth = req.headers['x-gateway-authenticated'];
  const userId = req.headers['x-user-id'];
  const username = req.headers['x-username'];
  const roles = req.headers['x-roles'];

  if (gatewayAuth === 'true' && userId) {
    // Request validado por el gateway - construir usuario desde headers
    // Parsear roles: el gateway los envía como string separado por comas
    const userRoles =
      typeof roles === 'string'
        ? roles.split(',').map((r) => r.trim())
        : roles || [];

    req.user = {
      id: userId,
      username: username || userId,
      roles: userRoles,
    };
    logger.info(
      `Request authenticated via gateway for user: ${req.user.username} (roles: ${userRoles.join(', ')})`
    );
    return next();
  }

  // Prioridad 2: Token JWT directo (acceso directo al microservicio, sin gateway)
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    logger.warn(`Unauthenticated request to ${req.path}`);
    return res.status(401).json({
      error: 'MISSING_TOKEN',
      message: 'Missing token',
    });
  }

  // Validar token usando Redis (verifica firma JWT y existencia en Redis)
  const tokenData = await tokenService.validateAccessToken(token);

  if (!tokenData) {
    logger.error(`Token validation failed for path: ${req.path}`);
    return res.status(403).json({
      error: 'TOKEN_EXPIRED_OR_INVALID',
      message: 'Invalid or expired token',
    });
  }

  // Adjuntar datos del usuario a la request
  req.user = tokenData;
  logger.info(
    `Token validated successfully for user: ${tokenData.username || tokenData.id}`
  );
  next();
};

export default verifyToken;
