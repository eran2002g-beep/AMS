// config/db.js - creates the database connection and exports it for use across the app

// Sequelize is the ORM - lets us use JS objects instead of raw SQL
const { Sequelize } = require('sequelize');

// Loads .env values into process.env
require('dotenv').config();

// Create one Sequelize connection using the Neon connection string from .env
const sequelize = new Sequelize(process.env.DATABASE_URL, {

    // Tell Sequelize we are using PostgreSQL (Neon is PostgreSQL)
    dialect: 'postgres',

    dialectOptions: {
        ssl: {
            require: true,           // Neon requires SSL - never set this to false
            rejectUnauthorized: false, // Accepts Neon's SSL certificate without a local CA file
        },
    },

    // Hides raw SQL logs in the terminal - set to console.log to debug queries
    logging: false,
});

// Export so models and server.js can share this same connection
module.exports = sequelize;