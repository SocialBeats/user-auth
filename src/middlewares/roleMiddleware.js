import logger from '../../logger.js';

/**
 * Middleware para verificar que el usuario autenticado tenga al menos uno de los roles requeridos
 * @param {string[]} allowedRoles - Array de roles permitidos para acceder a la ruta
 * @returns {Function} - Middleware de Express
 *
 * @example
 * // Permitir solo admins
 * router.get('/admin', requireRoles(['admin']), handler);
 *
 * // Permitir admins o moderadores
 * router.get('/moderate', requireRoles(['admin', 'moderator']), handler);
 */
export const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    // Verificar que el usuario esté autenticado (debe pasar por verifyToken primero)

    if (!req.user) {
      logger.warn(
        'Role check failed: No user in request (missing authentication)'
      );
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    // Verificar que el usuario tenga roles y convertir a array si es necesario
    let userRoles = req.user.roles;

    if (!userRoles) {
      logger.warn(`Role check failed: User ${req.user.username} has no roles`);
      return res.status(403).json({
        error: 'NO_ROLES_ASSIGNED',
        message: 'Access denied: No roles assigned',
      });
    }

    // Convertir a array si viene como string (por si acaso)
    if (typeof userRoles === 'string') {
      userRoles = userRoles.split(',').map((r) => r.trim());
    }

    if (!Array.isArray(userRoles)) {
      logger.warn(
        `Role check failed: User ${req.user.username} has invalid roles format`
      );
      return res.status(403).json({
        error: 'NO_ROLES_ASSIGNED',
        message: 'Access denied: Invalid roles format',
      });
    }

    // Verificar si el usuario tiene al menos uno de los roles permitidos
    const hasRequiredRole = userRoles.some((role) =>
      allowedRoles.includes(role)
    );

    if (!hasRequiredRole) {
      logger.warn(
        `Access denied for user ${req.user.username} (roles: ${userRoles.join(', ')}) to resource requiring: ${allowedRoles.join(', ')}`
      );
      return res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Unauthorized: Insufficient role',
        required: allowedRoles,
        current: userRoles,
      });
    }

    // Usuario tiene permisos, continuar
    logger.info(
      `Access granted to ${req.user.username} with role(s): ${userRoles.join(', ')}`
    );
    next();
  };
};

/**
 * Middleware para verificar que el usuario sea administrador
 * Atajo para requireRoles(['admin'])
 */
export const requireAdmin = requireRoles(['admin']);

/**
 * Middleware para verificar que el usuario sea beatmaker o administrador
 * Atajo para requireRoles(['beatmaker', 'admin'])
 */

export const requireBeatmaker = requireRoles(['beatmaker']);

export default { requireRoles, requireAdmin, requireBeatmaker };
