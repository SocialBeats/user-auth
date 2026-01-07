import User from '../models/User.js';
import logger from '../../logger.js';
import { deleteProfile, getProfileByUserId } from './profileService.js';
import { publishUserEvent } from './kafkaProducer.js';

/**
 * Get all users from the database
 * @returns {Promise<Array>} List of users
 */
export const getAllUsers = async () => {
  try {
    const users = await User.find({}, '-password'); // Exclude password
    return users;
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`);
    throw error;
  }
};

/**
 * Get a user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 */
export const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId, '-password');
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user;
  } catch (error) {
    logger.error(`Error fetching user ${userId}: ${error.message}`);
    throw error;
  }
};

/**
 * Get a user by username
 * @param {string} username - Username
 * @returns {Promise<Object>} User object
 */
export const getUserByUsername = async (username) => {
  try {
    const user = await User.findOne({ username }, '-password');
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user;
  } catch (error) {
    logger.error(`Error fetching user ${username}: ${error.message}`);
    throw error;
  }
};

/**
 * Update a user by username
 * @param {string} username - Username
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated user
 */
export const updateUserByUsername = async (username, updateData) => {
  try {
    const user = await User.findOne({ username });
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const allowedFields = ['email', 'username'];
    Object.keys(updateData).forEach((key) => {
      if (allowedFields.includes(key)) {
        user[key] = updateData[key];
      }
    });

    await user.save();
    const updatedUser = await User.findOne({ username }, '-password');

    await publishUserEvent('USER_UPDATED', {
      _id: updatedUser._id.toString(),
      username: updatedUser.username,
      email: updatedUser.email,
      roles: updatedUser.roles,
      updatedAt: updatedUser.updatedAt,
    });

    return updatedUser;
  } catch (error) {
    logger.error(`Error updating user ${username}: ${error.message}`);
    throw error;
  }
};

/**
 * Delete a user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deleted user
 */
export const deleteUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        throw new Error('No se puede eliminar el último administrador');
      }
    }

    try {
      const profile = await getProfileByUserId(userId);
      if (profile) {
        await deleteProfile(userId);
        logger.info(`Profile deleted for user ${userId}`);
      }
    } catch (profileError) {
      logger.warn(
        `Profile deletion failed for user ${userId}: ${profileError.message}`
      );
    }

    await publishUserEvent('USER_DELETED', {
      _id: userId.toString(),
      username: user.username,
    });

    const deletedUser = await User.findByIdAndDelete(userId);
    logger.info(`User deleted: ${user.username}`);
    return deletedUser;
  } catch (error) {
    logger.error(`Error deleting user ${userId}: ${error.message}`);
    throw error;
  }
};
