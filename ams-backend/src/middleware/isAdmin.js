const { verifyToken } = require('./authMiddleware');

const ADMIN_ROLES = new Set(['super-admin', 'admin', 'admin-manager']);
const isAdministrativeRole = (role) => ADMIN_ROLES.has(role);

// isAdmin - verifies the request carries a valid JWT with an administrative role
// Used to protect admin-only routes (e.g. DELETE /roster/by-date)
//
// Flow:
//   1. Reads the Authorization header and extracts the Bearer token
//   2. Decrypts and authenticates the token using JWT_ENCRYPTION_KEY
//   3. Checks the current Employee role grants administrative access
//   4. Attaches decoded user data to req.user for downstream handlers
const isAdmin = async (req, res, next) => {
    return verifyToken(req, res, () => {
        if (!isAdministrativeRole(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required.',
            });
        }

        return next();
    });
};

module.exports = isAdmin;
module.exports.isAdministrativeRole = isAdministrativeRole;
