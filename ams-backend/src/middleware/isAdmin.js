const jwt = require('jsonwebtoken');

// isAdmin - verifies the request carries a valid JWT with role = 'admin'
// Used to protect admin-only routes (e.g. DELETE /roster/by-date)
//
// Flow:
//   1. Reads the Authorization header and extracts the Bearer token
//   2. Verifies the token signature using JWT_SECRET from .env
//   3. Checks the decoded payload has role === 'admin'
//   4. Attaches decoded user data to req.user for downstream handlers
const isAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Reject if no Authorization header or not a Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: No token provided.',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Token is valid but user is not an admin
        if (decoded.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required.',
            });
        }

        // Attach user info to the request so controllers can use it if needed
        req.user = decoded;
        next();

    } catch (err) {
        // Token is expired, malformed, or signed with a different secret
        return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid or expired token.',
        });
    }
};

module.exports = isAdmin;