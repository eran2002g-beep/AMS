const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');

process.env.JWT_ENCRYPTION_KEY = randomBytes(32).toString('base64url');
process.env.JWT_ISSUER = 'ams-backend-test';
process.env.JWT_AUDIENCE = 'ams-frontend-test';

const { encryptToken, createAccessToken, decryptToken } = require('../src/services/tokenService');

test('encrypts claims and decrypts a valid token', async () => {
    const claims = {
        id: 'employee-1',
        email: 'employee@example.com',
        role: 'employee',
    };

    const token = await encryptToken(claims);
    const decrypted = await decryptToken(token);

    assert.equal(token.split('.').length, 5);
    assert.equal(token.includes(claims.email), false);
    assert.equal(decrypted.id, claims.id);
    assert.equal(decrypted.email, claims.email);
    assert.equal(decrypted.role, claims.role);
});

test('marks generated access tokens with their token type and session', async () => {
    const token = await createAccessToken({ id: 1, sid: 'session-1', role: 'admin' });
    const decrypted = await decryptToken(token);

    assert.equal(decrypted.tokenType, 'access');
    assert.equal(decrypted.sid, 'session-1');
});

test('preserves every employee role in access-token claims', async () => {
    const roles = ['employee', 'manager', 'admin-manager', 'admin', 'super-admin'];

    for (const role of roles) {
        const token = await createAccessToken({
            id: 1,
            employeeId: 'EMP001',
            sid: `session-${role}`,
            role,
        });
        const decrypted = await decryptToken(token);

        assert.equal(decrypted.role, role);
        assert.equal(decrypted.employeeId, 'EMP001');
    }
});

test('rejects a token when its ciphertext is altered', async () => {
    const token = await encryptToken({ id: 'employee-1', role: 'employee' });
    const parts = token.split('.');
    parts[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith('A') ? 'B' : 'A'}`;

    await assert.rejects(decryptToken(parts.join('.')));
});

test('rejects a token encrypted with another key', async () => {
    const originalKey = process.env.JWT_ENCRYPTION_KEY;
    const token = await encryptToken({ id: 'employee-1', role: 'employee' });
    process.env.JWT_ENCRYPTION_KEY = randomBytes(32).toString('base64url');

    await assert.rejects(decryptToken(token));
    process.env.JWT_ENCRYPTION_KEY = originalKey;
});

test('rejects an expired token', async () => {
    const originalExpiry = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = '-1s';
    const token = await encryptToken({ id: 'employee-1', role: 'employee' });
    process.env.JWT_EXPIRES_IN = originalExpiry || '8h';

    await assert.rejects(
        decryptToken(token),
        (error) => error.code === 'ERR_JWT_EXPIRED',
    );
});
