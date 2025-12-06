import User from '../models/User.js';
import logger from '../../logger.js';

export const initAdmin = async () => {
  try {
    const adminExists = await User.findOne({ roles: 'admin' });
    if (adminExists) {
      logger.info('Admin user already exists.');
      return;
    }

    const username = process.env.DEFAULT_ADMIN_USERNAME;
    const email = process.env.DEFAULT_ADMIN_EMAIL;
    const password = process.env.DEFAULT_ADMIN_PASSWORD;

    if (!username || !email || !password) {
      logger.error(
        'Missing required environment variables for default admin user. Please set DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, and DEFAULT_ADMIN_PASSWORD.'
      );
      return;
    }
    const admin = new User({
      username,
      email,
      password,
      roles: ['admin'],
    });

    await admin.save();
    logger.info(`Default admin created: ${username} (${email})`);
  } catch (error) {
    logger.error(`Error creating default admin: ${error.message}`);
  }
};
