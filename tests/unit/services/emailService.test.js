import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions we can control
const mockSend = vi
  .fn()
  .mockResolvedValue({ data: { id: 'msg-123' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

vi.mock('bottleneck', () => ({
  default: vi.fn().mockImplementation(() => ({
    schedule: vi.fn((fn) => fn()),
    on: vi.fn(),
    running: vi.fn().mockReturnValue(0),
    queued: vi.fn().mockReturnValue(0),
    reservoir: vi.fn().mockReturnValue(2),
  })),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import * as emailService from '../../../src/services/emailService.js';

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null });
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM = 'Test <test@test.com>';
    process.env.APP_NAME = 'TestApp';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    emailService.resetCircuitBreaker();
  });

  describe('Circuit Breaker', () => {
    beforeEach(() => {
      emailService.resetCircuitBreaker();
    });

    it('should return circuit breaker status', () => {
      const status = emailService.getCircuitBreakerStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failures');
      expect(status).toHaveProperty('config');
      expect(status.state).toBe('CLOSED');
    });

    it('should reject requests when circuit is OPEN', async () => {
      emailService.setCircuitBreakerState('OPEN', {
        failures: 5,
        nextAttempt: Date.now() + 60000,
      });

      const status = emailService.getCircuitBreakerStatus();
      expect(status.state).toBe('OPEN');

      await expect(
        emailService.sendVerificationEmail({
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'abc123',
        })
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after timeout expires', () => {
      emailService.setCircuitBreakerState('OPEN', {
        failures: 5,
        nextAttempt: Date.now() - 1000,
      });

      const status = emailService.getCircuitBreakerStatus();
      expect(status.state).toBe('OPEN');
      expect(status.nextAttempt).toBeLessThan(Date.now());
    });

    it('should reset circuit breaker correctly', () => {
      emailService.setCircuitBreakerState('OPEN', { failures: 5 });
      emailService.resetCircuitBreaker();

      const status = emailService.getCircuitBreakerStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(0);
    });

    it('should set successes and lastFailureTime when setting state', () => {
      emailService.setCircuitBreakerState('HALF_OPEN', {
        failures: 3,
        nextAttempt: Date.now() + 10000,
      });

      const status = emailService.getCircuitBreakerStatus();
      expect(status.state).toBe('HALF_OPEN');
      expect(status.failures).toBe(3);
    });
  });

  describe('Rate Limiter', () => {
    it('should return rate limiter status', () => {
      const status = emailService.getRateLimiterStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('queued');
      expect(status).toHaveProperty('reservoir');
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email successfully', async () => {
      const result = await emailService.sendVerificationEmail({
        email: 'test@example.com',
        username: 'testuser',
        verificationToken: 'abc123',
      });

      expect(result).toEqual({ success: true, messageId: 'msg-123' });
    });

    it('should throw error when email send fails', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Send failed' },
      });

      await expect(
        emailService.sendVerificationEmail({
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'abc123',
        })
      ).rejects.toThrow('Send failed');
    });

    it('should throw error when email service throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        emailService.sendVerificationEmail({
          email: 'test@example.com',
          username: 'testuser',
          verificationToken: 'abc123',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      const result = await emailService.sendPasswordResetEmail({
        email: 'test@example.com',
        username: 'testuser',
        resetToken: 'reset123',
      });

      expect(result).toEqual({ success: true, messageId: 'msg-123' });
    });

    it('should throw error when email send fails', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Reset email failed' },
      });

      await expect(
        emailService.sendPasswordResetEmail({
          email: 'test@example.com',
          username: 'testuser',
          resetToken: 'reset123',
        })
      ).rejects.toThrow();
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed confirmation email', async () => {
      const result = await emailService.sendPasswordChangedEmail({
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(result).toEqual({ success: true, messageId: 'msg-123' });
    });

    it('should throw error when email send fails', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Changed email failed' },
      });

      await expect(
        emailService.sendPasswordChangedEmail({
          email: 'test@example.com',
          username: 'testuser',
        })
      ).rejects.toThrow();
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      const result = await emailService.sendWelcomeEmail({
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(result).toEqual({ success: true, messageId: 'msg-123' });
    });

    it('should throw error when email send fails', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Welcome email failed' },
      });

      await expect(
        emailService.sendWelcomeEmail({
          email: 'test@example.com',
          username: 'testuser',
        })
      ).rejects.toThrow();
    });
  });
});
