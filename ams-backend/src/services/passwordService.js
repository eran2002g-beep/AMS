// src/services/passwordService.js - bcrypt helpers for employee passwords
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const hashPassword = async (plainTextPassword) => {
    if (typeof plainTextPassword !== 'string' || !plainTextPassword) {
        throw new Error('password is required');
    }
    return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
};

const comparePassword = async (plainTextPassword, passwordHash) => {
    if (!plainTextPassword || !passwordHash) {
        return false;
    }
    return bcrypt.compare(plainTextPassword, passwordHash);
};

module.exports = {
    SALT_ROUNDS,
    hashPassword,
    comparePassword,
};
