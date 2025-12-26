import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set required environment variables FIRST
process.env.RESEND_API_KEY = 'test-api-key';
process.env.EMAIL_FROM = 'test@example.com';
process.env.APP_NAME = 'TestApp';
process.env.FRONTEND_URL = 'https://test.example.com';

// Mock Resend SDK
const mockEmailsSend = vi.fn();
const mockResend = {
  emails: {
    send: mockEmailsSend,
  },
};

vi.mock('resend', () => ({
  Resend: vi.fn(() => mockResend),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks and env vars
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  setCircuitBreakerNextAttempt,
} from '../../../src/services/emailService.js';
import logger from '../../../logger.js';

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset circuit breaker to initial state
    resetCircuitBreaker();
  });

  describe('Circuit Breaker', () => {
    describe('getCircuitBreakerStatus', () => {
      it('should return circuit breaker status', () => {
        const status = getCircuitBreakerStatus();

        expect(status).toBeDefined();
        expect(status).toHaveProperty('state');
        expect(status).toHaveProperty('failures');
        expect(status).toHaveProperty('successes');
        expect(status).toHaveProperty('config');
        expect(status.config).toHaveProperty('failureThreshold');
        expect(status.config).toHaveProperty('successThreshold');
        expect(status.config).toHaveProperty('timeout');
      });
    });

    describe('CLOSED → OPEN transition', () => {
      it('should open circuit after threshold failures', async () => {
        const emailData = {
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'token123',
        };

        // Mock failures
        mockEmailsSend.mockResolvedValue({ error: { message: 'API Error' } });

        // Trigger failures up to threshold (5)
        for (let i = 0; i < 5; i++) {
          try {
            await sendVerificationEmail(emailData);
          } catch (error) {
            // Expected to fail
          }
        }

        const status = getCircuitBreakerStatus();
        expect(status.state).toBe('OPEN');
        expect(status.failures).toBe(5);
        expect(status.nextAttempt).toBeDefined();
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Circuit OPENED')
        );
      });

      it('should reject requests when circuit is OPEN', async () => {
        const emailData = {
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'token123',
        };

        // Open the circuit
        mockEmailsSend.mockResolvedValue({ error: { message: 'API Error' } });
        for (let i = 0; i < 5; i++) {
          try {
            await sendVerificationEmail(emailData);
          } catch (error) {
            // Expected to fail
          }
        }

        // Verify circuit is open
        const status = getCircuitBreakerStatus();
        expect(status.state).toBe('OPEN');

        // Attempt to send email with open circuit
        await expect(sendVerificationEmail(emailData)).rejects.toThrow(
          /Circuit breaker is OPEN/
        );
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Circuit Breaker OPEN')
        );
      });
    });

    describe('OPEN → HALF_OPEN transition', () => {
      it('should transition to HALF_OPEN after timeout', async () => {
        const emailData = {
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'token123',
        };

        // Open the circuit
        mockEmailsSend.mockResolvedValue({ error: { message: 'API Error' } });
        for (let i = 0; i < 5; i++) {
          try {
            await sendVerificationEmail(emailData);
          } catch (error) {
            // Expected to fail
          }
        }

        // Manually set nextAttempt to past
        setCircuitBreakerNextAttempt(Date.now() - 1000);

        // Mock successful response
        mockEmailsSend.mockResolvedValue({
          data: { id: 'msg-123' },
          error: null,
        });

        // Attempt to send email
        await sendVerificationEmail(emailData);

        const newStatus = getCircuitBreakerStatus();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('Transitioning to HALF_OPEN')
        );
      });
    });

    describe('HALF_OPEN → CLOSED transition', () => {
      it('should close circuit after successful requests in HALF_OPEN', async () => {
        const emailData = {
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'token123',
        };

        // Open the circuit
        mockEmailsSend.mockResolvedValue({ error: { message: 'API Error' } });
        for (let i = 0; i < 5; i++) {
          try {
            await sendVerificationEmail(emailData);
          } catch (error) {
            // Expected to fail
          }
        }

        // Set to HALF_OPEN by manipulating time
        setCircuitBreakerNextAttempt(Date.now() - 1000);

        // Mock successful responses
        mockEmailsSend.mockResolvedValue({
          data: { id: 'msg-123' },
          error: null,
        });

        // Send 2 successful requests (threshold)
        await sendVerificationEmail(emailData);
        await sendVerificationEmail(emailData);

        const newStatus = getCircuitBreakerStatus();
        expect(newStatus.state).toBe('CLOSED');
        expect(newStatus.failures).toBe(0);
        expect(newStatus.successes).toBe(0);
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('Circuit CLOSED - Email service recovered')
        );
      });
    });

    describe('HALF_OPEN → OPEN transition', () => {
      it('should reopen circuit on failure in HALF_OPEN state', async () => {
        const emailData = {
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'token123',
        };

        // Open the circuit
        mockEmailsSend.mockResolvedValue({ error: { message: 'API Error' } });
        for (let i = 0; i < 5; i++) {
          try {
            await sendVerificationEmail(emailData);
          } catch (error) {
            // Expected to fail
          }
        }

        // Set to HALF_OPEN
        setCircuitBreakerNextAttempt(Date.now() - 1000);

        // First request succeeds (enters HALF_OPEN)
        mockEmailsSend.mockResolvedValueOnce({
          data: { id: 'msg-123' },
          error: null,
        });
        await sendVerificationEmail(emailData);

        // Second request fails
        mockEmailsSend.mockResolvedValueOnce({
          error: { message: 'API Error' },
        });
        try {
          await sendVerificationEmail(emailData);
        } catch (error) {
          // Expected to fail
        }

        const newStatus = getCircuitBreakerStatus();
        expect(newStatus.state).toBe('OPEN');
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Back to OPEN state after HALF_OPEN failure')
        );
      });
    });

    describe('Success resets failures in CLOSED state', () => {
      it('should reset failure count on success in CLOSED state', async () => {
        const emailData = {
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'token123',
        };

        // Cause some failures (but below threshold)
        mockEmailsSend.mockResolvedValue({ error: { message: 'API Error' } });
        for (let i = 0; i < 3; i++) {
          try {
            await sendVerificationEmail(emailData);
          } catch (error) {
            // Expected to fail
          }
        }

        let status = getCircuitBreakerStatus();
        expect(status.failures).toBe(3);
        expect(status.state).toBe('CLOSED');

        // Successful request
        mockEmailsSend.mockResolvedValue({
          data: { id: 'msg-123' },
          error: null,
        });
        await sendVerificationEmail(emailData);

        status = getCircuitBreakerStatus();
        expect(status.failures).toBe(0);
        expect(status.state).toBe('CLOSED');
      });
    });
  });

  describe('Error Handling', () => {
    it.skip('should throw error when RESEND_API_KEY is not set', async () => {
      // Note: This test requires module reset which breaks subsequent tests
      // The functionality is tested in integration tests instead
    });

    it('should handle Resend API errors', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockResolvedValue({
        error: { message: 'Invalid API key' },
      });

      await expect(sendVerificationEmail(emailData)).rejects.toThrow(
        'Invalid API key'
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending verification email')
      );
    });

    it('should handle network errors', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockRejectedValue(new Error('Network error'));

      await expect(sendVerificationEmail(emailData)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('Email Template Generation', () => {
    it('should include correct verification URL in template', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      await sendVerificationEmail(emailData);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@example.com',
          to: 'test@example.com',
          subject: expect.stringContaining('Verifica'),
          html: expect.stringContaining(
            `${process.env.FRONTEND_URL}/verify-email?token=token123`
          ),
        })
      );
    });

    it('should include username in email template', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'JohnDoe',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      await sendVerificationEmail(emailData);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('JohnDoe'),
        })
      );
    });

    it('should include app name in template', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      await sendVerificationEmail(emailData);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('TestApp'),
        })
      );
    });

    it('should generate proper button HTML', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      await sendVerificationEmail(emailData);

      const callArgs = mockEmailsSend.mock.calls[0][0];
      expect(callArgs.html).toContain('<a href=');
      expect(callArgs.html).toContain('Verificar mi correo');
    });

    it('should generate proper info box HTML', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      await sendVerificationEmail(emailData);

      const callArgs = mockEmailsSend.mock.calls[0][0];
      expect(callArgs.html).toContain('⏰');
      expect(callArgs.html).toContain('Importante');
      expect(callArgs.html).toContain('24 horas');
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email successfully', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      const result = await sendVerificationEmail(emailData);

      expect(result).toEqual({ success: true, messageId: 'msg-123' });
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@example.com',
          to: 'test@example.com',
          subject: expect.stringContaining('Verifica'),
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Verification email sent successfully')
      );
    });

    it('should include verification token in URL', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'abc123xyz',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      await sendVerificationEmail(emailData);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('abc123xyz'),
        })
      );
    });

    it('should log error on failure', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'token123',
      };

      mockEmailsSend.mockResolvedValue({
        error: { message: 'Failed to send' },
      });

      await expect(sendVerificationEmail(emailData)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending verification email')
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-456' },
        error: null,
      });

      const result = await sendWelcomeEmail(emailData);

      expect(result).toEqual({ success: true, messageId: 'msg-456' });
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@example.com',
          to: 'test@example.com',
          subject: expect.stringContaining('Bienvenido'),
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Welcome email sent')
      );
    });

    it('should include frontend URL in welcome email', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-456' },
        error: null,
      });

      await sendWelcomeEmail(emailData);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(process.env.FRONTEND_URL),
        })
      );
    });

    it('should log error on failure', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
      };

      mockEmailsSend.mockResolvedValue({
        error: { message: 'Failed to send' },
      });

      await expect(sendWelcomeEmail(emailData)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending welcome email')
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        resetToken: 'reset123',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-789' },
        error: null,
      });

      const result = await sendPasswordResetEmail(emailData);

      expect(result).toEqual({ success: true, messageId: 'msg-789' });
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@example.com',
          to: 'test@example.com',
          subject: expect.stringContaining('Restablece'),
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Password reset email sent successfully')
      );
    });

    it('should include reset token in URL', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        resetToken: 'reset-token-456',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-789' },
        error: null,
      });

      await sendPasswordResetEmail(emailData);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(
            `${process.env.FRONTEND_URL}/reset-password?token=reset-token-456`
          ),
        })
      );
    });

    it('should include 1 hour expiration notice', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        resetToken: 'reset123',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-789' },
        error: null,
      });

      await sendPasswordResetEmail(emailData);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('1 hora'),
        })
      );
    });

    it('should log error on failure', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
        resetToken: 'reset123',
      };

      mockEmailsSend.mockResolvedValue({
        error: { message: 'Failed to send' },
      });

      await expect(sendPasswordResetEmail(emailData)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending password reset email')
      );
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed email successfully', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-999' },
        error: null,
      });

      const result = await sendPasswordChangedEmail(emailData);

      expect(result).toEqual({ success: true, messageId: 'msg-999' });
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@example.com',
          to: 'test@example.com',
          subject: expect.stringContaining('contraseña ha sido cambiada'),
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Password changed confirmation email sent')
      );
    });

    it('should include security warning', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
      };

      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg-999' },
        error: null,
      });

      await sendPasswordChangedEmail(emailData);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('¿No fuiste tú?'),
        })
      );
    });

    it('should log error on failure', async () => {
      const emailData = {
        email: 'test@example.com',
        username: 'testuser',
      };

      mockEmailsSend.mockResolvedValue({
        error: { message: 'Failed to send' },
      });

      await expect(sendPasswordChangedEmail(emailData)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending password changed email')
      );
    });
  });
});
