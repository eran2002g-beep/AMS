const { createHash, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const Employee = require('../models/Employee');
const AuthSession = require('../models/AuthSession');
const sequelize = require('../../config/db');
const { comparePassword, hashPassword } = require('./passwordService');
const { createAccessToken } = require('./tokenService');

const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const durationToMilliseconds = (duration) => {
    const match = /^(\d+)(s|m|h|d)$/.exec(duration);
    if (!match) {
        throw new Error('REFRESH_TOKEN_EXPIRES_IN must use s, m, h, or d (for example: 7d)');
    }
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return Number(match[1]) * multipliers[match[2]];
};

const hashRefreshSecret = (secret) => createHash('sha256')
    .update(`${secret}${process.env.REFRESH_TOKEN_PEPPER || ''}`)
    .digest('hex');

const hashesMatch = (left, right) => {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const parseRefreshToken = (token) => {
    if (!token || typeof token !== 'string') return null;
    const separator = token.indexOf('.');
    if (separator < 1) return null;
    const sessionId = token.slice(0, separator);
    const secret = token.slice(separator + 1);
    return sessionId && secret ? { sessionId, secret } : null;
};

const createRefreshCredentials = (sessionId) => {
    const secret = randomBytes(32).toString('base64url');
    return {
        token: `${sessionId}.${secret}`,
        hash: hashRefreshSecret(secret),
    };
};

const employeeResponse = (employee, token, refreshToken, sessionExpiresAt) => ({
    token,
    refreshToken,
    sessionExpiresAt: new Date(sessionExpiresAt).toISOString(),
    role: employee.role,
    employeeId: employee.employeeId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    mustChangePassword: !!employee.mustChangePassword,
});

const createAccessTokenFor = (employee, sessionId) => createAccessToken({
    id: employee.id,
    employeeId: employee.employeeId,
    email: employee.email,
    role: employee.role,
    mustChangePassword: !!employee.mustChangePassword,
    sid: sessionId,
});

// --- LOGIN ---------------------------------------------------
// login - validates credentials and returns an encrypted JWT token
// called by authController when POST /auth/login is received
const login = async (email, password) => {
    if (!email || !password) {
        throw new Error('Email and password are required');
    }

    const { Op } = require('sequelize');

const employee = await Employee.scope('withPassword').findOne({
    where: {
        [Op.or]: [
            { email },
            { employeeId: email }
        ]
    }
});
    if (!employee) {
        throw new Error('Invalid email or password');
    }

    if (!employee.isActive) {
        throw new Error('Your account has been deactivated. Contact your administrator.');
    }

    const isPasswordValid = await comparePassword(password, employee.password);
    if (!isPasswordValid) {
        throw new Error('Invalid email or password');
    }

    const sessionId = randomUUID();
    const refreshCredentials = createRefreshCredentials(sessionId);
    const expiresAt = new Date(Date.now() + durationToMilliseconds(REFRESH_TOKEN_TTL));

    await AuthSession.create({
        id: sessionId,
        employeeId: employee.id,
        refreshTokenHash: refreshCredentials.hash,
        expiresAt,
    });

    const token = await createAccessTokenFor(employee, sessionId);
    return employeeResponse(employee, token, refreshCredentials.token, expiresAt);
};

const refresh = async (refreshToken) => {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw new Error('Refresh token is missing or invalid');

    const result = await sequelize.transaction(async (transaction) => {
        const session = await AuthSession.findByPk(parsed.sessionId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!session || session.revokedAt || session.expiresAt <= new Date()) {
            return { invalid: true };
        }

        const presentedHash = hashRefreshSecret(parsed.secret);
        if (!hashesMatch(session.refreshTokenHash, presentedHash)) {
            return { invalid: true };
        }

        const employee = await Employee.findByPk(session.employeeId, { transaction });
        if (!employee || !employee.isActive) {
            await session.update({
                revokedAt: new Date(),
                revocationReason: 'Employee inactive or missing',
            }, { transaction });
            return { invalid: true };
        }

        const nextRefresh = createRefreshCredentials(session.id);
        await session.update({
            refreshTokenHash: nextRefresh.hash,
            lastUsedAt: new Date(),
        }, { transaction });

        const token = await createAccessTokenFor(employee, session.id);
        return employeeResponse(employee, token, nextRefresh.token, session.expiresAt);
    });

    if (result.invalid) throw new Error('Refresh token is expired or invalid');
    return result;
};

const logout = async (refreshToken) => {
    const parsed = parseRefreshToken(refreshToken);
    if (parsed) {
        const session = await AuthSession.findByPk(parsed.sessionId);
        if (session && !session.revokedAt) {
            const presentedHash = hashRefreshSecret(parsed.secret);
            if (hashesMatch(session.refreshTokenHash, presentedHash)) {
                await session.update({
                    revokedAt: new Date(),
                    revocationReason: 'User logged out',
                });
            }
        }
    }
    return { message: 'Logged out successfully.' };
};

const getActiveSessionUser = async (claims) => {
    if (claims.tokenType !== 'access' || !claims.sid || !claims.id) return null;

    const session = await AuthSession.findOne({
        where: {
            id: claims.sid,
            employeeId: claims.id,
            revokedAt: null,
        },
    });
    if (!session || session.expiresAt <= new Date()) return null;

    const employee = await Employee.findByPk(claims.id);
    if (!employee || !employee.isActive) return null;

    return {
        ...claims,
        employeeId: employee.employeeId,
        email: employee.email,
        role: employee.role,
        mustChangePassword: !!employee.mustChangePassword,
    };
};

/**
 * Authenticated user changes their own password (required after temp/reset).
 * Body: { currentPassword, newPassword }
 */
const changePassword = async (employeeId, currentPassword, newPassword, sessionId) => {
    if (!currentPassword || !newPassword) {
        throw Object.assign(new Error('Current password and new password are required'), { status: 400 });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        throw Object.assign(new Error('New password must be at least 8 characters'), { status: 400 });
    }
    if (currentPassword === newPassword) {
        throw Object.assign(new Error('New password must be different from the current password'), { status: 400 });
    }

    const employee = await Employee.scope('withPassword').findOne({ where: { employeeId } });
    if (!employee || !employee.isActive) {
        throw Object.assign(new Error('Employee not found'), { status: 404 });
    }

    const isValid = await comparePassword(currentPassword, employee.password);
    if (!isValid) {
        throw Object.assign(new Error('Current password is incorrect'), { status: 401 });
    }

    await employee.update({
        password: await hashPassword(newPassword),
        mustChangePassword: false,
    });

    await employee.reload();

    const token = sessionId
        ? await createAccessTokenFor(employee, sessionId)
        : undefined;

    return {
        message: 'Password updated successfully.',
        mustChangePassword: false,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
        ...(token ? { token } : {}),
    };
};

module.exports = {
    login,
    refresh,
    logout,
    getActiveSessionUser,
    changePassword,
    durationToMilliseconds,
};