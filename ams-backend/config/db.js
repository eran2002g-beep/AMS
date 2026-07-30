// config/db.js - creates the database connection and exports it for use across the app

// Sequelize is the ORM - lets us use JS objects instead of raw SQL
const { Sequelize } = require('sequelize');

// Loads .env values into process.env
require('dotenv').config();

// Create one Sequelize connection. During tests we use an in-memory SQLite
// database so the test suite can run without an external Postgres URL.
let sequelize;
// If running tests or no DATABASE_URL is configured, use sqlite in-memory.
if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
    });
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