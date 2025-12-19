import * as profileService from '../services/profileService.js';
import logger from '../../logger.js';

/**
 * Obtiene el perfil del usuario autenticado
 * @route GET /api/v1/profile/me
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await profileService.getProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: 'Profile not found for this user',
      });
    }

    res.status(200).json(profile);
  } catch (error) {
    logger.error(`Error fetching profile: ${error.message}`);
    next(error);
  }
};

/**
 * Obtiene el perfil de un usuario por username
 * @route GET /api/v1/profile/:username
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
