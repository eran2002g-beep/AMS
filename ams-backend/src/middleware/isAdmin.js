const { ROLES } = require('../../config/roles');

const ADMINISTRATIVE_ROLES = new Set([
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.ADMIN_MANAGER,
]);

const isAdministrativeRole = (role) => ADMINISTRATIVE_ROLES.has(role);

const isAdmin = (req, res, next) => {
    if (!req.user || !isAdministrativeRole(req.user.role)) {
        return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    return next();
};

module.exports = isAdmin;
module.exports.isAdministrativeRole = isAdministrativeRole;
