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
        message: 'Authentication required',
      });
    }

    // Verificar que el usuario tenga roles
    if (!req.user.roles || !Array.isArray(req.user.roles)) {
      logger.warn(`Role check failed: User ${req.user.username} has no roles`);
      return res.status(403).json({
        message: 'Access denied: No roles assigned',
      });
    }

    // Verificar si el usuario tiene al menos uno de los roles permitidos
    const hasRequiredRole = req.user.roles.some((role) =>
      allowedRoles.includes(role)
    );

    if (!hasRequiredRole) {
      logger.warn(
        `Access denied for user ${req.user.username} (roles: ${req.user.roles.join(', ')}) to resource requiring: ${allowedRoles.join(', ')}`
      );
      return res.status(401).json({
        message: 'Unauthorized: Insufficient role',
        required: allowedRoles,
        current: req.user.roles,
      });
    }

    // Usuario tiene permisos, continuar
    logger.info(
      `Access granted to ${req.user.username} with role(s): ${req.user.roles.join(', ')}`
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
