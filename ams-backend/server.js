// server.js - entry point, connects to the database then starts the Express server

// Express handles incoming HTTP requests and routes them to the right controller
const express = require('express');
const cors = require('cors'); // FIX: import CORS middleware

// Import the shared DB connection
const sequelize = require('./config/db');
// Must run before any process.env usage - loads values from .env
require('dotenv').config();

// ----------------------- Model Imports -----------------------
// Import all models here so sequelize.sync() creates their tables
// Every new model you add must be registered here

const Employee = require('./src/models/Employee');
const Roster   = require('./src/models/Roster');
const AttendanceLog = require('./src/models/AttendanceLog'); // Each punch card swipe from IoT or manual entry

// ----------------------- Model Routes -----------------------
const employeeRoutes = require('./src/routes/employeeRoute');
const rosterRoutes = require('./src/routes/rosterRoute');
const attendanceLogRoutes = require('./src/routes/attendanceLogRoute');

// ----------------------- Error Logging Middleware -----------------------
const { errorLogger, notFoundLogger } = require('./src/middleware/errorLogger');

const app = express();

// ----------------------- Middleware -----------------------

// Parses incoming JSON request bodies - needed so req.body works in controllers
app.use(express.json());

// FIX: Enable CORS BEFORE routes
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));

// ----------------------- Routes -----------------------

// Mount employee routes under /employee
app.use('/employee', employeeRoutes);

// Mount roster routes under /roster
app.use('/roster', rosterRoutes);

// Mount attendance log routes under /attendance-log
app.use('/attendance-log', attendanceLogRoutes);

// ----------------------- Error Handlers -----------------------
// Must be registered AFTER all routes so they only catch unmatched/errored requests
app.use(notFoundLogger);  // 404 - route not found
app.use(errorLogger);     // 500 - unhandled errors from controllers

// Use PORT from .env or fallback
const PORT = process.env.PORT || 5000;

// Step 1 - test the database connection
sequelize.authenticate()

    // Step 2 - apply known schema patches (sync alter alone is unreliable on PostgreSQL)
    .then(() => {
        console.log('');
        console.log('-------------------------------------------------------');
        console.log('Neon database connected successfully.');
        return sequelize.query(`
            ALTER TABLE employees
            ADD COLUMN IF NOT EXISTS roster BOOLEAN NOT NULL DEFAULT false;
        `);
    })

    // Step 3 - create or update tables to match model definitions
    // alter: true updates existing tables safely without deleting data
    .then(() => sequelize.sync({ alter: true }))

    // Step 4 - start the server only after the database is ready
    .then(() => {
        console.log('-------------------------------------------------------');
        console.log('Models synced with the database.');
        app.listen(PORT, () => {
            console.log('-------------------------------------------------------');
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })

    // If connection or sync fails, log the error and stop the process
    .catch((err) => {
        console.error('Database connection failed:', err);
        process.exit(1); // exit with error code - no point running without a database
    });