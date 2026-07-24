// src/middleware/authMiddleware.js - decrypts JWT tokens on protected routes
// runs BEFORE the controller — if token is missing or invalid, request is blocked here

const { decryptToken } = require('../services/tokenService');
const { getActiveSessionUser } = require('../services/authService');

// --- VERIFY TOKEN --------------------------------------------
// verifyToken - checks that a valid JWT exists in the Authorization header
// usage in routes: router.get('/protected', verifyToken, controller)
const verifyToken = async (req, res, next) => {

    // Token must be sent in the Authorization header as: Bearer <token>
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            status: 401,
            code: 'AUTH_REQUIRED',
            message: 'Access denied. No token provided.',
        });
    }

    // Split "Bearer <token>" and take the second part
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            status: 401,
            code: 'AUTH_REQUIRED',
            message: 'Access denied. Token format invalid.',
        });
    }

    try {
        // Decrypt and authenticate the JWE — throws if expired or tampered
        const decoded = await decryptToken(token);
        const activeUser = await getActiveSessionUser(decoded);
        if (!activeUser) {
            return res.status(401).json({
                success: false,
                status: 401,
                code: 'SESSION_INACTIVE',
                message: 'Session is no longer active.',
            });
        }

        // Attach the decoded payload to req.user so controllers can access it
        // e.g. req.user.role, req.user.employeeId
        req.user = activeUser;

        // Token is valid — pass control to the next middleware or controller
        next();

    } catch (err) {

        // An expired access token can normally be renewed through /auth/refresh.
        if (err.code === 'ERR_JWT_EXPIRED') {
            return res.status(401).json({
                success: false,
                status: 401,
                code: 'TOKEN_EXPIRED',
                message: 'Session expired. Please log in again.',
            });
        }

        // Any other JWT error means the token was tampered with or invalid
        return res.status(401).json({
            success: false,
            status: 401,
            code: 'INVALID_TOKEN',
            message: 'Invalid token.',
        });
    }
};

// --- ROLE GUARD ----------------------------------------------
// authorizeRoles - restricts a route to specific roles only
// usage: router.delete('/employee', verifyToken, authorizeRoles('admin'), controller)
// AC1 Epic 3: permissions shall be applied according to the assigned role
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {

        // req.user is set by verifyToken above — must run after verifyToken
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            // AC2 Epic 3: restricted features shall not be accessible
            return res.status(403).json({
                success: false,
                status: 403,
                code: 'FORBIDDEN',
                message: 'Access denied. Insufficient permissions.',
            });
        }

        next();
    };
};

// New alias: `authorize` — keeps the single-role contract (`req.user.role`) but
// provides a clearer name used by route imports (authorize(...roles)).
const authorize = (...allowedRoles) => authorizeRoles(...allowedRoles);

// authorizeOwnOrRoles - allow the named roles, or the signed-in user when the
// :employeeId path param is their own employeeId (self-service attendance).
const authorizeOwnOrRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({
                success: false,
                status: 403,
                code: 'FORBIDDEN',
                message: 'Access denied. Insufficient permissions.',
            });
        }

        const targetId = req.params.employeeId;
        if (targetId && req.user.employeeId === targetId) {
            return next();
        }

        if (allowedRoles.includes(req.user.role)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            status: 403,
            code: 'FORBIDDEN',
            message: 'Access denied. Insufficient permissions.',
        });
    };
};

// --- ADMIN SPECIFIC GUARD (NEW) ------------------------------
// authorizeAdmin - shorthand wrapper specifically for administrator restrictions
const authorizeAdmin = (req, res, next) => {
    // Reuses the existing authorizeRoles logic specifically for 'admin'
    return authorizeRoles('admin')(req, res, next);
};

module.exports = {
    verifyToken,
    authorizeRoles,
    authorize,
    authorizeOwnOrRoles,
    authorizeAdmin, // අලුතින් Export කලා
};