import { Resend } from 'resend';
import Bottleneck from 'bottleneck';
import logger from '../../logger.js';

// ============================================
// RATE LIMITER (Resend: máx 2 req/seg)
// ============================================

const emailLimiter = new Bottleneck({
  reservoir: 2,
  reservoirRefreshAmount: 2,
  reservoirRefreshInterval: 1000,
  maxConcurrent: 1,
  minTime: 500,
});

emailLimiter.on('queued', () => {
  const queued = emailLimiter.queued();
  if (queued > 0) {
    logger.info(`📧 Rate Limiter: ${queued} email(s) en cola`);
  }
});

export const getRateLimiterStatus = () => ({
  running: emailLimiter.running(),
  queued: emailLimiter.queued(),
  reservoir: emailLimiter.reservoir(),
});

// ============================================
// CIRCUIT BREAKER
// ============================================

/**
 * Estados del Circuit Breaker:
 * - CLOSED: Funcionamiento normal, las peticiones pasan
 * - OPEN: Circuito abierto, las peticiones fallan inmediatamente
 * - HALF_OPEN: Permite una petición de prueba para verificar recuperación
 */
const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

const CIRCUIT_CONFIG = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
};

const circuitBreaker = {
  state: CircuitState.CLOSED,
  failures: 0,
  successes: 0,
  lastFailureTime: null,
  nextAttempt: null,
};

/**
 * Verifica si el circuito permite una petición
 * @returns {boolean} - true si la petición puede proceder
 */
const canMakeRequest = () => {
  const now = Date.now();

  switch (circuitBreaker.state) {
    case CircuitState.CLOSED:
      return true;

    case CircuitState.OPEN:
      if (now >= circuitBreaker.nextAttempt) {
        circuitBreaker.state = CircuitState.HALF_OPEN;
        circuitBreaker.successes = 0;
        logger.info('📧 Circuit Breaker: Transitioning to HALF_OPEN state');
        return true;
      }
      return false;

    case CircuitState.HALF_OPEN:
      return true;

    default:
      return true;
  }
};

const recordSuccess = () => {
  if (circuitBreaker.state === CircuitState.HALF_OPEN) {
    circuitBreaker.successes++;
    if (circuitBreaker.successes >= CIRCUIT_CONFIG.successThreshold) {
      circuitBreaker.state = CircuitState.CLOSED;
      circuitBreaker.failures = 0;
      circuitBreaker.successes = 0;
      logger.info(
        '📧 Circuit Breaker: Circuit CLOSED - Email service recovered'
      );
    }
  } else if (circuitBreaker.state === CircuitState.CLOSED) {
    // Reset failures on success
    circuitBreaker.failures = 0;
  }
};

const recordFailure = () => {
  circuitBreaker.failures++;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.state === CircuitState.HALF_OPEN) {
    // Fallo en HALF_OPEN, volver a OPEN
    circuitBreaker.state = CircuitState.OPEN;
    circuitBreaker.nextAttempt = Date.now() + CIRCUIT_CONFIG.timeout;
    logger.warn(
      '📧 Circuit Breaker: Back to OPEN state after HALF_OPEN failure'
    );
  } else if (
    circuitBreaker.state === CircuitState.CLOSED &&
    circuitBreaker.failures >= CIRCUIT_CONFIG.failureThreshold
  ) {
    // Umbral de fallos alcanzado, abrir circuito
    circuitBreaker.state = CircuitState.OPEN;
    circuitBreaker.nextAttempt = Date.now() + CIRCUIT_CONFIG.timeout;
    logger.error(
      `📧 Circuit Breaker: Circuit OPENED after ${circuitBreaker.failures} failures. ` +
        `Next attempt in ${CIRCUIT_CONFIG.timeout / 1000}s`
    );
  }
};

export const getCircuitBreakerStatus = () => ({
  state: circuitBreaker.state,
  failures: circuitBreaker.failures,
  successes: circuitBreaker.successes,
  lastFailureTime: circuitBreaker.lastFailureTime,
  nextAttempt: circuitBreaker.nextAttempt,
  config: CIRCUIT_CONFIG,
});

// Funciones para testing
export const resetCircuitBreaker = () => {
  circuitBreaker.state = CircuitState.CLOSED;
  circuitBreaker.failures = 0;
  circuitBreaker.successes = 0;
  circuitBreaker.lastFailureTime = null;
  circuitBreaker.nextAttempt = null;
};

export const setCircuitBreakerState = (state, options = {}) => {
  circuitBreaker.state = state;
  if (options.failures !== undefined)
    circuitBreaker.failures = options.failures;
  if (options.nextAttempt !== undefined)
    circuitBreaker.nextAttempt = options.nextAttempt;
};

// ============================================
// CLIENTE DE RESEND
// ============================================

let resend = null;

/**
 * Obtiene el cliente de Resend, inicializándolo si es necesario
 * @returns {Resend} - Cliente de Resend
 */
const getResendClient = () => {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

/**
 * Envía un email usando Circuit Breaker + Rate Limiter
 * @param {Object} emailOptions - Opciones del email (from, to, subject, html)
 * @returns {Promise<Object>} - Resultado del envío
 * @throws {Error} - Si el circuito está abierto o el envío falla
 */
const sendEmailWithCircuitBreaker = async (emailOptions) => {
  if (!canMakeRequest()) {
    const timeRemaining = Math.ceil(
      (circuitBreaker.nextAttempt - Date.now()) / 1000
    );
    logger.warn(
      `📧 Circuit Breaker OPEN: Email request rejected. Retry in ${timeRemaining}s`
    );
    throw new Error(
      `Email service temporarily unavailable. Circuit breaker is OPEN. Retry in ${timeRemaining}s`
    );
  }

  // Usar rate limiter para respetar el límite de 2 req/seg de Resend
  return emailLimiter.schedule(async () => {
    try {
      const { data, error } = await getResendClient().emails.send(emailOptions);

      if (error) {
        recordFailure();
        throw new Error(error.message);
      }

      recordSuccess();
      return { success: true, messageId: data?.id };
    } catch (error) {
      recordFailure();
      throw error;
    }
  });
};

const FROM_EMAIL = process.env.EMAIL_FROM;
const APP_NAME = process.env.APP_NAME;
const FRONTEND_URL = process.env.FRONTEND_URL;

const THEME = {
  primary: '#8b5cf6',
  primaryDark: '#7c3aed',
  primaryLight: '#a78bfa',
  secondary: '#ec4899',
  secondaryDark: '#db2777',
  bgMain: '#0f172a',
  bgCard: '#1e293b',
  textMain: '#f8fafc',
  textMuted: '#94a3b8',
  textLight: '#e2e8f0',
  success: '#10b981',
  error: '#ef4444',
  gradientPrimary: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
};

const getEmailTemplate = ({ title, headerGradient, content, footerText }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${THEME.bgMain};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: ${THEME.bgCard}; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: ${headerGradient};">
              <img src="https://user-s3-fis.fra1.cdn.digitaloceanspaces.com/logo-dark.png" alt="${APP_NAME}" style="height: 150px; margin-bottom: 16px;" />
              <h1 style="margin: 0; color: ${THEME.textMain}; font-size: 24px; font-weight: 700;">${title}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: rgba(0, 0, 0, 0.2); text-align: center;">
              ${footerText ? `<p style="margin: 0 0 12px; color: ${THEME.textMuted}; font-size: 13px; line-height: 1.5;">${footerText}</p>` : ''}
              <p style="margin: 0; color: #475569; font-size: 12px;">
                © ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getButtonHtml = (text, url, gradient = THEME.gradientPrimary) => `
<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="${url}" style="display: inline-block; padding: 14px 32px; background: ${gradient}; color: ${THEME.textMain}; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);">
        ${text}
      </a>
    </td>
  </tr>
</table>
`;

const getInfoBoxHtml = (emoji, title, message, borderColor = THEME.primary) => `
<div style="margin-top: 24px; padding: 16px; background-color: rgba(139, 92, 246, 0.1); border-radius: 10px; border-left: 3px solid ${borderColor};">
  <p style="margin: 0 0 6px; color: ${THEME.textMain}; font-size: 14px; font-weight: 600;">${emoji} ${title}</p>
  <p style="margin: 0; color: ${THEME.textMuted}; font-size: 13px; line-height: 1.5;">${message}</p>
</div>
`;

export const sendVerificationEmail = async ({
  email,
  username,
  verificationToken,
}) => {
  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const content = `
    <h2 style="margin: 0 0 16px; color: ${THEME.textMain}; font-size: 20px;">¡Hola, ${username}! 👋</h2>
    <p style="margin: 0 0 16px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      Gracias por registrarte en <strong style="color: ${THEME.textLight}">${APP_NAME}</strong>.
    </p>
    <p style="margin: 0 0 8px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      Para activar tu cuenta, verifica tu correo electrónico haciendo clic en el siguiente botón:
    </p>
    ${getButtonHtml('Verificar mi correo', verificationUrl)}
    <p style="margin: 24px 0 0; color: #475569; font-size: 13px; line-height: 1.5;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin: 8px 0 0; word-break: break-all;">
      <a href="${verificationUrl}" style="color: ${THEME.primaryLight}; font-size: 13px;">${verificationUrl}</a>
    </p>
    ${getInfoBoxHtml('⏰', 'Importante', 'Este enlace expirará en 24 horas.', THEME.primary)}
  `;

  try {
    const result = await sendEmailWithCircuitBreaker({
      from: FROM_EMAIL,
      to: email,
      subject: `Verifica tu correo electrónico`,
      html: getEmailTemplate({
        title: 'Verifica tu correo',
        headerGradient: THEME.gradientPrimary,
        content,
        footerText:
          'Si no creaste esta cuenta, puedes ignorar este correo de forma segura.',
      }),
    });

    logger.info(`Verification email sent successfully to ${email}`);
    return result;
  } catch (error) {
    logger.error(`Error sending verification email: ${error.message}`);
    throw error;
  }
};

export const sendPasswordResetEmail = async ({
  email,
  username,
  resetToken,
}) => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  const gradientReset = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';

  const content = `
    <h2 style="margin: 0 0 16px; color: ${THEME.textMain}; font-size: 20px;">Hola, ${username} 👋</h2>
    <p style="margin: 0 0 16px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong style="color: ${THEME.textLight}">${APP_NAME}</strong>.
    </p>
    <p style="margin: 0 0 8px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      Haz clic en el siguiente botón para crear una nueva contraseña:
    </p>
    ${getButtonHtml('Restablecer contraseña', resetUrl, gradientReset)}
    <p style="margin: 24px 0 0; color: #475569; font-size: 13px; line-height: 1.5;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin: 8px 0 0; word-break: break-all;">
      <a href="${resetUrl}" style="color: #f093fb; font-size: 13px;">${resetUrl}</a>
    </p>
    ${getInfoBoxHtml('⚠️', 'Importante', 'Este enlace expirará en 1 hora por razones de seguridad.', '#f5576c')}
  `;

  try {
    const result = await sendEmailWithCircuitBreaker({
      from: FROM_EMAIL,
      to: email,
      subject: `Restablece tu contraseña`,
      html: getEmailTemplate({
        title: 'Restablecer Contraseña',
        headerGradient: gradientReset,
        content,
        footerText:
          'Si no solicitaste restablecer tu contraseña, puedes ignorar este correo. Tu contraseña no cambiará.',
      }),
    });

    logger.info(`Password reset email sent successfully to ${email}`);
    return result;
  } catch (error) {
    logger.error(`Error sending password reset email: ${error.message}`);
    throw error;
  }
};

export const sendPasswordChangedEmail = async ({ email, username }) => {
  const gradientSuccess = 'linear-gradient(135deg, #10b981 0%, #34d399 100%)';

  const content = `
    <h2 style="margin: 0 0 16px; color: ${THEME.textMain}; font-size: 20px;">Hola, ${username} 👋</h2>
    <p style="margin: 0 0 16px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      Te confirmamos que la contraseña de tu cuenta en <strong style="color: ${THEME.textLight}">${APP_NAME}</strong> ha sido cambiada exitosamente.
    </p>
    <p style="margin: 0 0 16px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      Si realizaste este cambio, no necesitas hacer nada más.
    </p>
    ${getInfoBoxHtml('⚠️', '¿No fuiste tú?', 'Si no realizaste este cambio, tu cuenta puede estar comprometida. Por favor, contacta con nuestro equipo de soporte inmediatamente.', '#ef4444')}
  `;

  try {
    const result = await sendEmailWithCircuitBreaker({
      from: FROM_EMAIL,
      to: email,
      subject: `Tu contraseña ha sido cambiada`,
      html: getEmailTemplate({
        title: 'Contraseña Actualizada',
        headerGradient: gradientSuccess,
        content,
        footerText: null,
      }),
    });

    logger.info(`Password changed confirmation email sent to ${email}`);
    return result;
  } catch (error) {
    logger.error(`Error sending password changed email: ${error.message}`);
    throw error;
  }
};

export const sendWelcomeEmail = async ({ email, username }) => {
  const content = `
    <h2 style="margin: 0 0 16px; color: ${THEME.textMain}; font-size: 20px;">¡Bienvenido a ${APP_NAME}, ${username}! 🎉</h2>
    <p style="margin: 0 0 16px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      Tu correo electrónico ha sido verificado exitosamente. ¡Ya eres parte de nuestra comunidad!
    </p>
    <p style="margin: 0 0 16px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      Ahora tienes acceso completo a todas las funcionalidades de <strong style="color: ${THEME.textLight}">${APP_NAME}</strong>.
    </p>
    <p style="margin: 0 0 8px; color: ${THEME.textMuted}; font-size: 15px; line-height: 1.6;">
      ¡Es hora de explorar y crear música increíble!
    </p>
    ${getButtonHtml(`Ir a ${APP_NAME}`, FRONTEND_URL)}
  `;

  try {
    const result = await sendEmailWithCircuitBreaker({
      from: FROM_EMAIL,
      to: email,
      subject: `¡Bienvenido a ${APP_NAME}!`,
      html: getEmailTemplate({
        title: `¡Bienvenido a ${APP_NAME}!`,
        headerGradient: THEME.gradientPrimary,
        content,
        footerText: null,
      }),
    });

    logger.info(`Welcome email sent to ${email}`);
    return result;
  } catch (error) {
    logger.error(`Error sending welcome email: ${error.message}`);
    throw error;
  }
};
