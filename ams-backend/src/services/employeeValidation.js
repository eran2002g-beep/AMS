const VALID_ROLES = ['admin', 'employee'];

const normalizeString = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const validateEmployeePayload = (data = {}, { requireAllFields = false } = {}) => {
    const errors = [];
    const normalized = {};

    const firstName = normalizeString(data.firstName);
    if (requireAllFields || data.firstName !== undefined) {
        if (!firstName) {
            errors.push('firstName is required');
        } else {
            normalized.firstName = firstName;
        }
    }

    const lastName = normalizeString(data.lastName);
    if (requireAllFields || data.lastName !== undefined) {
        if (!lastName) {
            errors.push('lastName is required');
        } else {
            normalized.lastName = lastName;
        }
    }

    const email = normalizeString(data.email);
    if (requireAllFields || data.email !== undefined) {
        if (!email) {
            errors.push('email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('email must be a valid email address');
        } else {
            normalized.email = email.toLowerCase();
        }
    }

    if (data.phone !== undefined) {
        const phone = normalizeString(data.phone);
        if (phone && !/^[0-9+()\-\s]{7,15}$/.test(phone)) {
            errors.push('phone must be a valid phone number');
        } else if (phone) {
            normalized.phone = phone;
        } else {
            normalized.phone = null;
        }
    }

    if (data.department !== undefined) {
        const department = normalizeString(data.department);
        if (department) {
            normalized.department = department;
        } else {
            errors.push('department cannot be empty');
        }
    }

    if (data.role !== undefined) {
        const role = normalizeString(data.role).toLowerCase();
        if (!VALID_ROLES.includes(role)) {
            errors.push('role must be either admin or employee');
        } else {
            normalized.role = role;
        }
    }

    if (data.roster !== undefined) {
        if (typeof data.roster !== 'boolean') {
            errors.push('roster must be a boolean');
        } else {
            normalized.roster = data.roster;
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }

    return normalized;
};

module.exports = {
    VALID_ROLES,
    validateEmployeePayload,
};
