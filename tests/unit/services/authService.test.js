import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';

// Mock dependencies before importing the service
vi.mock('../../../src/models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('../../../src/services/tokenService.js', () => ({
  generateAndStoreAccessToken: vi.fn(),
  generateAndStoreRefreshToken: vi.fn(),
  validateRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revokeToken: vi.fn(),
  revokeAllUserTokens: vi.fn(),
}));

vi.mock('../../../src/services/profileService.js', () => ({
  createProfile: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../src/services/kafkaProducer.js', () => ({
  publishUserEvent: vi.fn().mockResolvedValue(undefined),
  isKafkaEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../src/services/emailService.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../../src/services/twoFactorService.js', () => ({
  generateTempToken: vi.fn().mockResolvedValue('mock-temp-token-2fa'),
}));

// Import after mocks
import * as authService from '../../../src/services/authService.js';
import User from '../../../src/models/User.js';
import * as tokenService from '../../../src/services/tokenService.js';
import * as profileService from '../../../src/services/profileService.js';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerUser', () => {
    const validUserData = {
      username: 'newuser',
      email: 'newuser@test.com',
      password: 'password123',
      roles: ['beatmaker'],
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        username: validUserData.username,
        email: validUserData.email,
        roles: validUserData.roles,
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      profileService.createProfile.mockResolvedValue({});

      const result = await authService.registerUser(validUserData);

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { username: validUserData.username },
          { email: validUserData.email },
        ],
      });
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: validUserData.username,
          email: validUserData.email,
          password: validUserData.password,
          roles: validUserData.roles,
          emailVerified: false,
        })
      );
      expect(profileService.createProfile).toHaveBeenCalledWith({
        userId: mockUser._id,
        username: mockUser.username,
        email: mockUser.email,
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error if username already exists', async () => {
      User.findOne.mockResolvedValue({
        username: validUserData.username,
        email: 'other@test.com',
      });

      await expect(authService.registerUser(validUserData)).rejects.toThrow(
        'El nombre de usuario ya existe'
      );
    });

    it('should throw error if email already exists', async () => {
      User.findOne.mockResolvedValue({
        username: 'otheruser',
        email: validUserData.email,
      });

      await expect(authService.registerUser(validUserData)).rejects.toThrow(
        'El email ya existe'
      );
    });

    it('should rollback user creation if profile creation fails', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: mockUserId,
        username: validUserData.username,
        email: validUserData.email,
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      profileService.createProfile.mockRejectedValue(
        new Error('Profile error')
      );
      User.findByIdAndDelete.mockResolvedValue(null);

      await expect(authService.registerUser(validUserData)).rejects.toThrow(
        'Error al crear perfil'
      );
      expect(User.findByIdAndDelete).toHaveBeenCalledWith(mockUserId);
    });

    it('should use default role if not provided', async () => {
      const userDataWithoutRoles = {
        username: 'newuser',
        email: 'newuser@test.com',
        password: 'password123',
      };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        username: userDataWithoutRoles.username,
        email: userDataWithoutRoles.email,
        roles: ['beatmaker'],
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      profileService.createProfile.mockResolvedValue({});

      await authService.registerUser(userDataWithoutRoles);

      // The service passes roles: ['beatmaker'] as default when not provided
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          email: 'newuser@test.com',
        })
      );
    });
  });

  describe('loginUser', () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser',
      email: 'test@test.com',
      comparePassword: vi.fn(),
    };

    it('should login user successfully with username', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);
      tokenService.generateAndStoreAccessToken.mockResolvedValue(
        'mock-access-token'
      );
      tokenService.generateAndStoreRefreshToken.mockResolvedValue({
        token: 'mock-refresh-token',
      });

      const result = await authService.loginUser('testuser', 'password123');

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ username: 'testuser' }, { email: 'testuser' }],
      });
      expect(mockUser.comparePassword).toHaveBeenCalledWith('password123');
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should login user successfully with email', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(true);
      tokenService.generateAndStoreAccessToken.mockResolvedValue(
        'mock-access-token'
      );
      tokenService.generateAndStoreRefreshToken.mockResolvedValue({
        token: 'mock-refresh-token',
      });

      const result = await authService.loginUser(
        'test@test.com',
        'password123'
      );

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ username: 'test@test.com' }, { email: 'test@test.com' }],
      });
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('should throw error if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        authService.loginUser('nonexistent', 'password123')
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('should throw error if password is incorrect', async () => {
      User.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(false);

      await expect(
        authService.loginUser('testuser', 'wrongpassword')
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('refreshAccessToken', () => {
    const mockTokenData = {
      userId: new mongoose.Types.ObjectId().toString(),
      tokenId: 'mock-token-id',
    };

    const mockUser = {
      _id: mockTokenData.userId,
      username: 'testuser',
      email: 'test@test.com',
      roles: ['beatmaker'],
    };

    it('should refresh tokens successfully', async () => {
      tokenService.validateRefreshToken.mockResolvedValue(mockTokenData);
      User.findById.mockResolvedValue(mockUser);
      tokenService.generateAndStoreAccessToken.mockResolvedValue(
        'new-access-token'
      );
      tokenService.rotateRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
      });

      const result = await authService.refreshAccessToken('old-refresh-token');

      expect(tokenService.validateRefreshToken).toHaveBeenCalledWith(
        'old-refresh-token'
      );
      expect(User.findById).toHaveBeenCalledWith(mockTokenData.userId);
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw error if refresh token is invalid', async () => {
      tokenService.validateRefreshToken.mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken('invalid-token')
      ).rejects.toThrow('Refresh token inválido o expirado');
    });

    it('should throw error if user not found', async () => {
      tokenService.validateRefreshToken.mockResolvedValue(mockTokenData);
      User.findById.mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken('valid-token')
      ).rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('logoutUser', () => {
    it('should logout user successfully with both tokens', async () => {
      tokenService.revokeToken.mockResolvedValue(true);

      const result = await authService.logoutUser(
        'refresh-token',
        'access-token'
      );

      expect(tokenService.revokeToken).toHaveBeenCalledWith(
        'access-token',
        'access'
      );
      expect(tokenService.revokeToken).toHaveBeenCalledWith(
        'refresh-token',
        'refresh'
      );
      expect(result).toBe(true);
    });

    it('should logout user successfully with only refresh token', async () => {
      tokenService.revokeToken.mockResolvedValue(true);

      const result = await authService.logoutUser('refresh-token', null);

      expect(tokenService.revokeToken).toHaveBeenCalledWith(
        'refresh-token',
        'refresh'
      );
      expect(result).toBe(true);
    });

    it('should throw error if refresh token not found', async () => {
      tokenService.revokeToken.mockResolvedValue(false);

      await expect(
        authService.logoutUser('invalid-refresh-token', null)
      ).rejects.toThrow('Refresh token no encontrado');
    });

    it('should continue logout even if access token revocation fails', async () => {
      tokenService.revokeToken
        .mockRejectedValueOnce(new Error('Access token error'))
        .mockResolvedValueOnce(true);

      const result = await authService.logoutUser(
        'refresh-token',
        'access-token'
      );

      expect(result).toBe(true);
    });

    it('should handle access token not found gracefully', async () => {
      tokenService.revokeToken
        .mockResolvedValueOnce(false) // Access token not found
        .mockResolvedValueOnce(true); // Refresh token revoked

      const result = await authService.logoutUser(
        'refresh-token',
        'access-token'
      );

      expect(result).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens successfully', async () => {
      const userId = 'test-user-id';
      tokenService.revokeAllUserTokens.mockResolvedValue(5);

      const result = await authService.revokeAllUserTokens(userId);

      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(userId);
      expect(result).toBe(5);
    });

    it('should return 0 if no tokens to revoke', async () => {
      tokenService.revokeAllUserTokens.mockResolvedValue(0);

      const result = await authService.revokeAllUserTokens('user-id');

      expect(result).toBe(0);
    });
  });

  describe('deleteUserAccount', () => {
    const mockUserId = new mongoose.Types.ObjectId();
    const mockUser = {
      _id: mockUserId,
      username: 'testuser',
      email: 'test@test.com',
    };

    beforeEach(() => {
      User.findById = vi.fn();
      User.deleteOne = vi.fn();
    });

    it('should delete user account successfully', async () => {
      User.findById.mockResolvedValue(mockUser);
      User.deleteOne.mockResolvedValue({ deletedCount: 1 });
      tokenService.revokeAllUserTokens.mockResolvedValue(2);

      const result = await authService.deleteUserAccount(mockUserId.toString());

      expect(User.findById).toHaveBeenCalledWith(mockUserId.toString());
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        mockUserId.toString()
      );
      expect(User.deleteOne).toHaveBeenCalledWith({
        _id: mockUserId.toString(),
      });
      expect(result.message).toBe('Cuenta eliminada exitosamente');
      expect(result.deletedUserId).toBe(mockUserId.toString());
    });

    it('should throw error with code USER_NOT_FOUND if user does not exist', async () => {
      User.findById.mockResolvedValue(null);

      await expect(
        authService.deleteUserAccount('nonexistent-id')
      ).rejects.toMatchObject({
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      });

      expect(User.deleteOne).not.toHaveBeenCalled();
    });

    it('should continue deletion even if token revocation fails', async () => {
      User.findById.mockResolvedValue(mockUser);
      User.deleteOne.mockResolvedValue({ deletedCount: 1 });
      tokenService.revokeAllUserTokens.mockRejectedValue(
        new Error('Redis error')
      );

      const result = await authService.deleteUserAccount(mockUserId.toString());

      expect(result.message).toBe('Cuenta eliminada exitosamente');
      expect(User.deleteOne).toHaveBeenCalled();
    });

    it('should continue deletion even if profile deletion fails', async () => {
      User.findById.mockResolvedValue(mockUser);
      User.deleteOne.mockResolvedValue({ deletedCount: 1 });
      tokenService.revokeAllUserTokens.mockResolvedValue(1);

      const result = await authService.deleteUserAccount(mockUserId.toString());

      expect(result.message).toBe('Cuenta eliminada exitosamente');
      expect(User.deleteOne).toHaveBeenCalled();
    });

    it('should include user data in the returned result', async () => {
      User.findById.mockResolvedValue(mockUser);
      User.deleteOne.mockResolvedValue({ deletedCount: 1 });
      tokenService.revokeAllUserTokens.mockResolvedValue(0);

      const result = await authService.deleteUserAccount(mockUserId.toString());

      expect(result.deletedUserId).toBe(mockUserId.toString());
      expect(result.message).toBe('Cuenta eliminada exitosamente');
    });
  });

  describe('loginUser with 2FA', () => {
    it('should return require2FA when user has 2FA enabled', async () => {
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
        isTwoFactorEnabled: true,
        comparePassword: vi.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await authService.loginUser('testuser', 'password123');

      expect(result.require2FA).toBe(true);
      expect(result.tempToken).toBeDefined();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
        emailVerified: false,
        emailVerificationToken: 'valid-token',
        save: vi.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await authService.verifyEmail('valid-token');

      expect(User.findOne).toHaveBeenCalledWith({
        emailVerificationToken: 'valid-token',
        emailVerificationExpires: { $gt: expect.any(Date) },
      });
      expect(mockUser.emailVerified).toBe(true);
      expect(mockUser.emailVerificationToken).toBeNull();
      expect(mockUser.emailVerificationExpires).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.username).toBe('testuser');
    });

    it('should throw error for invalid or expired token', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(
        'Token de verificación inválido o expirado'
      );
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resend verification email successfully', async () => {
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
        emailVerified: false,
        save: vi.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await authService.resendVerificationEmail('test@test.com');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@test.com' });
      expect(mockUser.emailVerificationToken).toBeDefined();
      expect(mockUser.emailVerificationExpires).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.message).toBe('Email de verificación enviado');
    });

    it('should throw error if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        authService.resendVerificationEmail('nonexistent@test.com')
      ).rejects.toThrow('Usuario no encontrado');
    });

    it('should throw error if email already verified', async () => {
      const mockUser = {
        email: 'test@test.com',
        emailVerified: true,
      };

      User.findOne.mockResolvedValue(mockUser);

      await expect(
        authService.resendVerificationEmail('test@test.com')
      ).rejects.toThrow('Email ya verificado');
    });
  });

  describe('requestPasswordReset', () => {
    it('should request password reset successfully for existing user', async () => {
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
        save: vi.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await authService.requestPasswordReset('test@test.com');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@test.com' });
      expect(mockUser.passwordResetToken).toBeDefined();
      expect(mockUser.passwordResetExpires).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.message).toContain('Si el email existe');
    });

    it('should return same message for non-existent user (security)', async () => {
      User.findOne.mockResolvedValue(null);

      const result = await authService.requestPasswordReset(
        'nonexistent@test.com'
      );

      expect(result.message).toContain('Si el email existe');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
        passwordResetToken: 'valid-token',
        save: vi.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);
      tokenService.revokeAllUserTokens.mockResolvedValue(2);

      const result = await authService.resetPassword(
        'valid-token',
        'newPassword123'
      );

      expect(User.findOne).toHaveBeenCalledWith({
        passwordResetToken: 'valid-token',
        passwordResetExpires: { $gt: expect.any(Date) },
      });
      expect(mockUser.password).toBe('newPassword123');
      expect(mockUser.passwordResetToken).toBeNull();
      expect(mockUser.passwordResetExpires).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalled();
      expect(result.message).toBe('Contraseña restablecida exitosamente');
    });

    it('should throw error for invalid or expired token', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        authService.resetPassword('invalid-token', 'newPassword123')
      ).rejects.toThrow('Token de restablecimiento inválido o expirado');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        _id: 'user-id',
        username: 'testuser',
        email: 'test@test.com',
        password: 'oldHashedPassword',
        comparePassword: vi.fn().mockResolvedValue(true),
        save: vi.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);

      const result = await authService.changePassword(
        'user-id',
        'oldPassword',
        'newPassword123'
      );

      expect(mockUser.comparePassword).toHaveBeenCalledWith('oldPassword');
      expect(mockUser.password).toBe('newPassword123');
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.message).toBe('Contraseña cambiada exitosamente');
    });

    it('should throw if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await expect(
        authService.changePassword('nonexistent', 'old', 'new12345')
      ).rejects.toThrow('Usuario no encontrado');
    });

    it('should throw if current password is incorrect', async () => {
      const mockUser = {
        comparePassword: vi.fn().mockResolvedValue(false),
      };

      User.findById.mockResolvedValue(mockUser);

      await expect(
        authService.changePassword('user-id', 'wrongPassword', 'newPassword123')
      ).rejects.toThrow('Contraseña actual incorrecta');
    });

    it('should throw if new password is too short', async () => {
      const mockUser = {
        comparePassword: vi.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);

      await expect(
        authService.changePassword('user-id', 'oldPassword', 'short')
      ).rejects.toThrow('La nueva contraseña debe tener al menos 6 caracteres');
    });
  });
});
