import Profile from '../models/Profile.js';
import logger from '../../logger.js';

/**
 * Crea un perfil asociado a un usuario recién registrado
 * @param {Object} userData - Datos del usuario (userId, username, email)
 * @returns {Promise<Object>} - El perfil creado
 */
export async function createProfile(userData) {
  try {
    const { userId, username, email } = userData;

    // Validar que los datos requeridos estén presentes
    if (!userId || !username || !email) {
      throw new Error(
        'userId, username, and email are required to create a profile'
      );
    }

    // Crear el perfil con valores por defecto
    const profile = new Profile({
      userId,
      username,
      email,
      about_me: '',
      avatar: '',
      full_name: '',
      contact: {
        phone: '',
        city: '',
        country: '',
        website: '',
        social_media: {
          instagram: '',
          twitter: '',
          youtube: '',
          soundcloud: '',
          spotify: '',
        },
      },
      studies: [],
      tags: [],
      certifications: [],
    });

    await profile.save();

    logger.info(`Profile created for user ${username} (ID: ${userId})`);

    return profile;
  } catch (error) {
    logger.error(`Error creating profile: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene el perfil de un usuario por su userId
 * @param {String} userId - ID del usuario
 * @returns {Promise<Object|null>} - El perfil o null si no existe
 */
export async function getProfileByUserId(userId) {
  try {
    const profile = await Profile.findOne({ userId });
    return profile;
  } catch (error) {
    logger.error(`Error fetching profile for user ${userId}: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene el perfil de un usuario por su username
 * @param {String} username - Username del usuario
 * @returns {Promise<Object|null>} - El perfil o null si no existe
 */
export async function getProfileByUsername(username) {
  try {
    const profile = await Profile.findOne({ username });
    return profile;
  } catch (error) {
    logger.error(
      `Error fetching profile for username ${username}: ${error.message}`
    );
    throw error;
  }
}

/**
 * Actualiza el perfil de un usuario
 * @param {String} userId - ID del usuario
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object|null>} - El perfil actualizado o null si no existe
 */
export async function updateProfile(userId, updateData) {
  try {
    // Campos que NO se pueden actualizar directamente (son duplicados de User)
    const restrictedFields = ['userId', 'username', 'email'];
    restrictedFields.forEach((field) => delete updateData[field]);

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    logger.info(`Profile updated for user ${userId}`);

    return profile;
  } catch (error) {
    logger.error(`Error updating profile for user ${userId}: ${error.message}`);
    throw error;
  }
}

/**
 * Elimina el perfil de un usuario
 * @param {String} userId - ID del usuario
 * @returns {Promise<Object|null>} - El perfil eliminado o null si no existe
 */
export async function deleteProfile(userId) {
  try {
    const profile = await Profile.findOneAndDelete({ userId });

    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    logger.info(`Profile deleted for user ${userId}`);

    return profile;
  } catch (error) {
    logger.error(`Error deleting profile for user ${userId}: ${error.message}`);
    throw error;
  }
}
