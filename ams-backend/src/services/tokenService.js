// Creates and decrypts authenticated, encrypted JWTs (compact JWE).
const { createSecretKey } = require('node:crypto');

const TOKEN_ISSUER = process.env.JWT_ISSUER || 'ams-backend';
const TOKEN_AUDIENCE = process.env.JWT_AUDIENCE || 'ams-frontend';

let josePromise;

const loadJose = () => {
    josePromise ||= import('jose');
    return josePromise;
};

const getEncryptionKey = () => {
    const encodedKey = process.env.JWT_ENCRYPTION_KEY;

    if (!encodedKey) {
        throw new Error('JWT_ENCRYPTION_KEY is not configured');
    }

    const keyBytes = Buffer.from(encodedKey, 'base64url');

    if (keyBytes.length !== 32) {
        throw new Error('JWT_ENCRYPTION_KEY must be a base64url-encoded 32-byte key');
    }

    return createSecretKey(keyBytes);
};

const encryptToken = async (payload, expiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m') => {
    const { EncryptJWT } = await loadJose();

    return new EncryptJWT(payload)
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: 'JWT' })
        .setIssuedAt()
        .setIssuer(TOKEN_ISSUER)
        .setAudience(TOKEN_AUDIENCE)
        .setExpirationTime(expiresIn)
        .encrypt(getEncryptionKey());
};

const decryptToken = async (token) => {
    const { jwtDecrypt } = await loadJose();
    const { payload } = await jwtDecrypt(token, getEncryptionKey(), {
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: ['A256GCM'],
    });

    return payload;
};

const createAccessToken = (payload) => encryptToken({
    ...payload,
    tokenType: 'access',
});

module.exports = {
    encryptToken,
    createAccessToken,
    decryptToken,
};
