// src/middleware/authMiddleware.js - verifies JWT token on every protected route
// runs BEFORE the controller — if token is missing or invalid, request is blocked here

const jwt = require('jsonwebtoken');

// --- VERIFY TOKEN --------------------------------------------
// verifyToken - checks that a valid JWT exists in the Authorization header
// usage in routes: router.get('/protected', verifyToken, controller)
const verifyToken = (req, res, next) => {

    // Token must be sent in the Authorization header as: Bearer <token>
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Split "Bearer <token>" and take the second part
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. Token format invalid.' });
    }

    try {
        // Verify the token against JWT_SECRET — throws if expired or tampered
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the decoded payload to req.user so controllers can access it
        // e.g. req.user.role, req.user.employeeId
        req.user = decoded;

        // Token is valid — pass control to the next middleware or controller
        next();

    } catch (err) {

        // TokenExpiredError means the 8h window has passed (AC4: session terminated)
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }

        // Any other JWT error means the token was tampered with or invalid
        return res.status(401).json({ message: 'Invalid token.' });
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
            return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
        }

        next();
    };
};

module.exports = {
    verifyToken,
    authorizeRoles,
};