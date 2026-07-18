const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AuthSession = sequelize.define('AuthSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    employeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'employee_id',
        references: {
            model: 'employees',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    refreshTokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'refresh_token_hash',
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
    },
    lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at',
    },
    revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at',
    },
    revocationReason: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'revocation_reason',
    },
}, {
    tableName: 'auth_sessions',
    timestamps: true,
    indexes: [
        { fields: ['employee_id'] },
        { fields: ['expires_at'] },
    ],
});

module.exports = AuthSession;
