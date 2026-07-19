// src/services/authService.js - business logic for login and logout
// handles credential validation, JWT generation and session termination

const jwt = require('jsonwebtoken');

const Employee = require('../models/Employee');
const { comparePassword } = require('./passwordService');

// --- LOGIN ---------------------------------------------------
// login - validates credentials and returns a signed JWT token
// called by authController when POST /auth/login is received
const login = async (email, password) => {

    // AC2: return error if email or password is missing
    if (!email || !password) {
        throw new Error('Email and password are required');
    }

    // Load the password hash explicitly because the default scope excludes it
    const employee = await Employee.scope('withPassword').findOne({ where: { email } });

    // AC2: return generic message so attackers can't tell which field is wrong
    if (!employee) {
        throw new Error('Invalid email or password');
    }

    // Reject login if the account has been deactivated (soft deleted)
    if (!employee.isActive) {
        throw new Error('Your account has been deactivated. Contact your administrator.');
    }

    // Compare the plain-text password against the stored hashed password
    const isPasswordValid = await comparePassword(password, employee.password);

    // AC2: wrong password — same generic message as wrong email
    if (!isPasswordValid) {
        throw new Error('Invalid email or password');
    }

    // Build the JWT payload — what gets encoded inside the token
    // keep it small: only store what middleware needs to check permissions
    const payload = {
        id:         employee.id,
        employeeId: employee.employeeId,
        email:      employee.email,
        role:       employee.role, // one of src/config/roles.js ROLES — used for RBAC in middleware
    };

    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }

    // Sign the token using the secret from .env
    // expiresIn means the token automatically becomes invalid after 8 hours (AC4)
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    // AC3: return role so the frontend can redirect to the correct dashboard
    return {
        token,
        role:       employee.role,
        employeeId: employee.employeeId,
        firstName:  employee.firstName,
        lastName:   employee.lastName,
    };
};

// --- LOGOUT --------------------------------------------------
// logout - JWT is stateless so we cannot invalidate a token server-side by default
// the frontend is responsible for deleting the token from storage
// this function exists as a clean endpoint for the frontend to call on logout (AC4)
const logout = () => {
    // Return a confirmation message — actual session termination happens on the client
    // by removing the token from localStorage or cookies
    return { message: 'Logged out successfully. Please remove the token from client storage.' };
};

module.exports = {
    login,
    logout,
};