import User from '../models/User.js';
import logger from '../../logger.js';

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
            throw new Error('User not found');
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
            throw new Error('User not found');
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
            throw new Error('User not found');
        }

        Object.keys(updateData).forEach((key) => {
            // Simply update the field, ignoring password concerns as requested
            user[key] = updateData[key];
        });

        await user.save();
        return user;
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
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            throw new Error('User not found');
        }
        logger.info(`User deleted: ${user.username}`);
        return user;
    } catch (error) {
        logger.error(`Error deleting user ${userId}: ${error.message}`);
        throw error;
    }
};
