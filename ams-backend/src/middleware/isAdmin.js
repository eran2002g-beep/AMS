const { verifyToken } = require('./authMiddleware');

// isAdmin - verifies the request carries a valid JWT with role = 'admin'
// Used to protect admin-only routes (e.g. DELETE /roster/by-date)
//
// Flow:
//   1. Reads the Authorization header and extracts the Bearer token
//   2. Decrypts and authenticates the token using JWT_ENCRYPTION_KEY
//   3. Checks the decoded payload has role === 'admin'
//   4. Attaches decoded user data to req.user for downstream handlers
const isAdmin = async (req, res, next) => {
    return verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required.',
            });
        }

        return next();
    });
};

module.exports = isAdmin;
