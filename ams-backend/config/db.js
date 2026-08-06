// config/db.js - creates the database connection and exports it for use across the app

// Sequelize is the ORM - lets us use JS objects instead of raw SQL
const { Sequelize } = require('sequelize');

// Loads .env values into process.env
require('dotenv').config();

// Create one Sequelize connection. During tests we use an in-memory SQLite
// database so the test suite can run without an external Postgres URL.
let sequelize;
if (process.env.NODE_ENV === 'test') {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
    });
} else if (!process.env.DATABASE_URL) {
    // Fail fast — silent SQLite fallback looked like a Neon connection and then
    // crashed on Postgres-only ALTER statements against missing tables.
    throw new Error(
        'DATABASE_URL is not set. Copy ams-backend/env-sample to ams-backend/.env '
        + 'and paste your Neon connection string (Neon Console → Connect).',
    );
} else {
    // Use the Neon/Postgres connection string from .env in non-test runs
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
        logging: false,
    });
}

// Export so models and server.js can share this same connection
module.exports = sequelize;