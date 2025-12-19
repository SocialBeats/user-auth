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
/**
 * Busca perfiles por string de búsqueda (username)
 * @param {String} query - String de búsqueda
 * @returns {Promise<Array>} - Array de perfiles encontrados
 */
/**
 * Busca perfiles por string de búsqueda (username, full_name, email)
 * @param {String} query - String de búsqueda
 * @returns {Promise<Array>} - Array de perfiles encontrados
 */
export async function searchProfiles(query) {
  try {
    const searchRegex = { $regex: query, $options: 'i' };
    const profiles = await Profile.find(
      {
        $or: [
          { username: searchRegex },
          { full_name: searchRegex },
          { email: searchRegex },
        ],
      },
      'userId username full_name avatar email'
    );
    return profiles;
  } catch (error) {
    logger.error(`Error searching profiles: ${error.message}`);
    throw error;
  }
}

/**
 * Obtiene todos los perfiles con paginación
 * @param {Number} page - Número de página (default 1)
 * @param {Number} limit - Límite por página (default 10)
 * @returns {Promise<Object>} - Objeto con perfiles y metadata de paginación
 */
export async function getAllProfiles(page = 1, limit = 10) {
  try {
    const skip = (page - 1) * limit;

    const [profiles, total] = await Promise.all([
      Profile.find({}, 'userId username full_name avatar about_me tags')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Profile.countDocuments(),
    ]);

    return {
      profiles,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error(`Error fetching all profiles: ${error.message}`);
    throw error;
  }
}

/**
 * Calcula el estado de completitud del perfil
 * @param {String} userId - ID del usuario
 * @returns {Promise<Object>} - Estado de completitud con pasos, porcentaje y nivel
 */
export async function getProfileCompletionStatus(userId) {
  try {
    const profile = await Profile.findOne({ userId });

    if (!profile) {
      throw new Error(`Profile not found for user ${userId}`);
    }

    // Definición de los 8 pasos
    const steps = [
      {
        id: 1,
        name: 'basic_info',
        label: 'Información básica',
        required: true,
        completed: !!(
          profile.full_name?.trim().length >= 2 &&
          profile.contact?.city?.trim() &&
          profile.contact?.country?.trim()
        ),
      },
      {
        id: 2,
        name: 'about_me',
        label: 'Sobre mí',
        required: true,
        completed: profile.about_me?.trim().length >= 50,
      },
      {
        id: 3,
        name: 'avatar',
        label: 'Foto de perfil',
        required: true,
        completed: !!profile.avatar?.trim(),
      },
      {
        id: 4,
        name: 'contact',
        label: 'Información de contacto',
        required: true,
        completed: !!(
          profile.contact?.phone?.trim() || profile.contact?.website?.trim()
        ),
      },
      {
        id: 5,
        name: 'skills',
        label: 'Aptitudes',
        required: true,
        completed: Array.isArray(profile.tags) && profile.tags.length >= 3,
      },
      {
        id: 6,
        name: 'education',
        label: 'Educación',
        required: false,
        skippable: true,
        completed:
          Array.isArray(profile.studies) && profile.studies.length >= 1,
      },
      {
        id: 7,
        name: 'certifications',
        label: 'Certificaciones',
        required: false,
        skippable: true,
        completed:
          Array.isArray(profile.certifications) &&
          profile.certifications.length >= 1,
      },
      {
        id: 8,
        name: 'identity',
        label: 'Verificación de identidad',
        required: true,
        completed: profile.identityVerified === true,
      },
    ];

    // Calcular porcentaje basado solo en pasos requeridos
    const requiredSteps = steps.filter((s) => s.required);
    const completedRequired = requiredSteps.filter((s) => s.completed).length;
    const completionPercentage = Math.round(
      (completedRequired / requiredSteps.length) * 100
    );

    // Determinar nivel de verificación
    // Una vez verificada la identidad, siempre es verificado (permanente)
    const verificationLevel =
      profile.identityVerified === true ? 'verified' : 'none';

    // Encontrar el siguiente paso requerido incompleto
    const nextStep = steps.find((s) => s.required && !s.completed) || null;

    return {
      steps,
      completionPercentage,
      verificationLevel,
      nextStep: nextStep
        ? { id: nextStep.id, name: nextStep.name, label: nextStep.label }
        : null,
      totalSteps: steps.length,
      requiredSteps: requiredSteps.length,
      completedSteps: steps.filter((s) => s.completed).length,
      completedRequiredSteps: completedRequired,
    };
  } catch (error) {
    logger.error(`Error getting profile completion status: ${error.message}`);
    throw error;
  }
}
