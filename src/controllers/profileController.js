import * as profileService from '../services/profileService.js';
import User from '../models/User.js';
import logger from '../../logger.js';

export const updateVerificationStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, provider_id } = req.body;

    logger.info(
      `Actualizando estado de verificación para usuario: ${userId} a ${status}`
    );

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (status === 'VERIFICADO') {
      user.identityVerified = true;
      // Podríamos guardar el provider_id si el modelo lo soportara
      // user.verificationId = provider_id;
    } else {
      // Manejar otros estados si es necesario
      user.identityVerified = false;
    }

    await user.save();

    logger.info(`Estado de verificación actualizado para usuario: ${userId}`);
    res
      .status(200)
      .json({ message: 'Estado de verificación actualizado correctamente' });
  } catch (error) {
    logger.error(`Error actualizando verificación: ${error.message}`);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Obtiene el perfil del usuario autenticado
 * @route GET /api/v1/profile/me
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Obtener perfil COMPLETO y estado de verificación del usuario
    const [profile, user] = await Promise.all([
      profileService.getFullProfileByUserId(userId),
      User.findById(userId).select('emailVerified'),
    ]);

    if (!profile) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: 'Profile not found for this user',
      });
    }

    // Incluir emailVerified en la respuesta
    const profileData = profile.toObject ? profile.toObject() : { ...profile };
    profileData.emailVerified = user?.emailVerified ?? false;

    res.status(200).json(profileData);
  } catch (error) {
    logger.error(`Error fetching profile: ${error.message}`);
    next(error);
  }
};

/**
 * Obtiene el perfil de un usuario por username
 * @route GET /api/v1/profile/username/:username
 */
export const getProfileByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;

    const profile = await profileService.getProfileByUsername(username);

    if (!profile) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: `Profile not found for user ${username}`,
      });
    }

    res.status(200).json(profile);
  } catch (error) {
    logger.error(`Error fetching profile: ${error.message}`);
    next(error);
  }
};

/**
 * Obtiene el perfil de un usuario por userId
 * @route GET /api/v1/profile/user/:userId
 */
export const getProfileByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const profile = await profileService.getProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: `Profile not found for userId ${userId}`,
      });
    }

    res.status(200).json(profile);
  } catch (error) {
    logger.error(`Error fetching profile by userId: ${error.message}`);
    next(error);
  }
};

/**
 * Obtiene el perfil de un usuario - detecta automáticamente si es userId o username
 * @route GET /api/v1/profile/:identifier
 */
export const getProfileByIdentifier = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let profile;

    // Check if identifier looks like a MongoDB ObjectId (24 hex characters)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

    if (isObjectId) {
      // Try to find by userId
      profile = await profileService.getFullProfileByUserId(identifier);
    } else {
      // Find by username
      profile = await profileService.getProfileByUsername(identifier);
    }

    if (!profile) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: `Profile not found for ${isObjectId ? 'userId' : 'username'}: ${identifier}`,
      });
    }

    res.status(200).json(profile);
  } catch (error) {
    logger.error(`Error fetching profile by identifier: ${error.message}`);
    next(error);
  }
};

/**
 * Actualiza el perfil del usuario autenticado
 * @route PUT /api/v1/profile/me
 */
export const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Validar que no se intenten actualizar campos restringidos
    const restrictedFields = ['userId', 'username', 'email'];
    const hasRestrictedFields = restrictedFields.some(
      (field) => field in updateData
    );

    if (hasRestrictedFields) {
      return res.status(400).json({
        error: 'INVALID_UPDATE',
        message: 'Cannot update userId, username, or email from profile',
      });
    }

    const profile = await profileService.updateProfile(userId, updateData);

    res.status(200).json(profile);
  } catch (error) {
    logger.error(`Error updating profile: ${error.message}`);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: error.message,
      });
    }

    next(error);
  }
};

/**
 * Elimina el perfil del usuario autenticado
 * @route DELETE /api/v1/profile/me
 */
export const deleteMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await profileService.deleteProfile(userId);

    res.status(200).json({
      message: 'Profile deleted successfully',
    });
  } catch (error) {
    logger.error(`Error deleting profile: ${error.message}`);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: error.message,
      });
    }

    next(error);
  }
};

/**
 * Busca perfiles
 * @route GET /api/v1/profile/search
 */
export const searchProfiles = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'MISSING_SEARCH_TERM',
        message: 'Search term (q) is required',
      });
    }

    const profiles = await profileService.searchProfiles(q);

    res.status(200).json({
      profiles,
    });
  } catch (error) {
    logger.error(`Error searching profiles: ${error.message}`);
    next(error);
  }
};

/**
 * Obtiene todos los perfiles (explorar)
 * @route GET /api/v1/profile
 */
export const getAllProfiles = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await profileService.getAllProfiles(page, limit);

    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error fetching all profiles: ${error.message}`);
    next(error);
  }
};

/**
 * Obtiene el estado de completitud del perfil
 * @route GET /api/v1/profile/me/completion-status
 */
export const getCompletionStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const completionStatus =
      await profileService.getProfileCompletionStatus(userId);

    res.status(200).json(completionStatus);
  } catch (error) {
    logger.error(`Error getting completion status: ${error.message}`);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: error.message,
      });
    }

    next(error);
  }
};
