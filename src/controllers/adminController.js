import logger from '../../logger.js';
import * as authService from '../services/authService.js';
import * as adminService from '../services/adminService.js';

/**
 * Create a new admin user
 */
export const createAdmin = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                error: 'MISSING_FIELDS',
                message: 'Username, email and password are required',
            });
        }

        await authService.registerUser({
            username,
            email,
            password,
            roles: ['admin'],
        });

        res.status(201).json({
            message: 'Admin created successfully',
        });
    } catch (error) {
        logger.error(`Admin creation error: ${error.message}`);
        if (error.message.includes('exists')) {
            return res.status(409).json({
                error: 'DUPLICATE_ENTRY',
                message: error.message,
            });
        }
        res.status(500).json({
            error: 'CREATION_FAILED',
            message: 'Failed to create admin',
        });
    }
};

/**
 * List all users
 */
export const listUsers = async (req, res) => {
    try {
        const users = await adminService.getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({
            error: 'FETCH_FAILED',
            message: 'Failed to fetch users',
        });
    }
};

/**
 * Get a user by ID
 */
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await adminService.getUserById(id);
        res.status(200).json(user);
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found',
            });
        }
        res.status(500).json({
            error: 'FETCH_FAILED',
            message: 'Failed to fetch user',
        });
    }
};

/**
 * Get a user by username
 */
export const getUserByUsername = async (req, res) => {
    try {
        const { username } = req.params;
        const user = await adminService.getUserByUsername(username);
        res.status(200).json(user);
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found',
            });
        }
        res.status(500).json({
            error: 'FETCH_FAILED',
            message: 'Failed to fetch user',
        });
    }
};

/**
 * Update a user by username
 */
export const updateUser = async (req, res) => {
    try {
        const { username } = req.params;
        const updateData = req.body;

        const updatedUser = await adminService.updateUserByUsername(username, updateData);
        res.status(200).json({
            message: 'User updated successfully',
            user: updatedUser,
        });
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found',
            });
        }
        res.status(500).json({
            error: 'UPDATE_FAILED',
            message: 'Failed to update user',
        });
    }
};

/**
 * Delete a user
 */
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await adminService.deleteUser(id);
        res.status(200).json({
            message: 'User deleted successfully',
        });
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found',
            });
        }
        res.status(500).json({
            error: 'DELETE_FAILED',
            message: 'Failed to delete user',
        });
    }
};
