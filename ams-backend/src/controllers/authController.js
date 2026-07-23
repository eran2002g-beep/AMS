// src/controllers/authController.js - handles HTTP requests and responses for authentication
// calls authService for business logic, never touches the database directly

const authService = require('../services/authService');
const employeeService = require('../services/employeeService');

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'ams_refresh';
const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: authService.durationToMilliseconds(process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'),
};

const getRefreshCookie = (req) => {
    const cookies = req.headers.cookie;
    if (!cookies) return null;

    for (const item of cookies.split(';')) {
        const [rawName, ...rawValue] = item.trim().split('=');
        if (rawName === REFRESH_COOKIE_NAME) {
            return decodeURIComponent(rawValue.join('='));
        }
    }
    return null;
};

const setRefreshCookie = (res, refreshToken) => {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
};

const clearRefreshCookie = (res) => {
    const { maxAge, ...options } = refreshCookieOptions;
    res.clearCookie(REFRESH_COOKIE_NAME, options);
};

// --- LOGIN CONTROLLER ----------------------------------------
// login - receives POST /auth/login, validates body, calls service, returns token
const login = async (req, res) => {

    try {
        const { email, password } = req.body;

        const { refreshToken, ...result } = await authService.login(email, password);
        setRefreshCookie(res, refreshToken);

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

const refresh = async (req, res) => {
    try {
        const { refreshToken, ...result } = await authService.refresh(getRefreshCookie(req));
        setRefreshCookie(res, refreshToken);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(401).json({ message: err.message });
    }
};

// --- LOGOUT CONTROLLER ----------------------------------------
// logout - receives POST /auth/logout, confirms session termination
const logout = async (req, res) => {

    try {
        const result = await authService.logout(getRefreshCookie(req));
        clearRefreshCookie(res);

        // AC4: session terminated — return 200 with confirmation
        return res.status(200).json(result);

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = {
    login,
    refresh,
    logout,
    profile,
};

// --- PROFILE CONTROLLER --------------------------------------
// profile - returns the signed-in user's full employee record
const profile = async (req, res) => {
    try {
        // req.user is set by verifyToken middleware and contains employeeId
        const employee = await employeeService.getEmployeeById(req.user.employeeId);
        return res.status(200).json({ success: true, data: employee });
    } catch (err) {
        const status = err.message && err.message.includes('not found') ? 404 : 500;
        return res.status(status).json({ success: false, error: err.message });
    }
};