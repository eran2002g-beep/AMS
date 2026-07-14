// src/controllers/authController.js - handles HTTP requests and responses for authentication
// calls authService for business logic, never touches the database directly

const authService = require('../services/authService');

// --- LOGIN CONTROLLER ----------------------------------------
// login - receives POST /auth/login, validates body, calls service, returns token
const login = async (req, res) => {

    try {
        const { email, password } = req.body;

        const result = await authService.login(email, password);

        // AC1: authentication successful — return 200 with token and role info
        return res.status(200).json({
            message: 'Login successful.',
            ...result, // spreads token, role, employeeId, firstName, lastName
        });

    } catch (err) {

        // AC2: invalid credentials — return 401 with the error message from service
        return res.status(401).json({ message: err.message });
    }
};

// --- LOGOUT CONTROLLER ----------------------------------------
// logout - receives POST /auth/logout, confirms session termination
const logout = (req, res) => {

    try {
        const result = authService.logout();

        // AC4: session terminated — return 200 with confirmation
        return res.status(200).json(result);

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = {
    login,
    logout,
};