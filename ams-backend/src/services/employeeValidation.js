const VALID_ROLES = ['admin', 'employee'];
const MIN_PASSWORD_LENGTH = 8;

const normalizeString = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const validatePassword = (password, { required = false } = {}) => {
    if (password === undefined || password === null) {
        if (required) {
            return { error: 'password is required' };
        }
        return { value: undefined };
    }

    if (typeof password !== 'string') {
        return { error: 'password must be a string' };
    }

    // Do not trim passwords — spaces may be intentional
    if (!password) {
        if (required) {
            return { error: 'password is required' };
        }
        return { value: undefined };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }

    return { value: password };
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

    // Password required when creating; optional when updating (omit = leave unchanged)
    const passwordResult = validatePassword(data.password, { required: requireAllFields });
    if (passwordResult.error) {
        errors.push(passwordResult.error);
    } else if (passwordResult.value !== undefined) {
        normalized.password = passwordResult.value;
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
