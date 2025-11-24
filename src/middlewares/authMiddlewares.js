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
  '/api/v1/auth/logout',
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
  } else if (!req.path.startsWith('/api/v')) {
    return res
      .status(400)
      .json({ message: 'You must specify the API version, e.g. /api/v1/...' });
  }

  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    logger.warn(`Unauthenticated request to ${req.path}`);
    return res.status(401).json({ message: 'Missing token' });
  }

  // Validar token usando Redis (verifica firma JWT y existencia en Redis)
  const tokenData = await tokenService.validateAccessToken(token);

  if (!tokenData) {
    logger.error(`Token validation failed for path: ${req.path}`);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  // Adjuntar datos del usuario a la request
  req.user = tokenData;
  logger.info(
    `Token validated successfully for user: ${tokenData.username || tokenData.id}`
  );
  next();
};

export default verifyToken;
