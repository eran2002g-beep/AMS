// server.js - entry point, connects to the database then starts the Express server

// Must run before any process.env usage / DB import - loads values from .env
require('dotenv').config();

// Express handles incoming HTTP requests and routes them to the right controller
const express = require('express');
const cors = require('cors'); // FIX: import CORS middleware

// Import the shared DB connection
const sequelize = require('./config/db');

// ----------------------- Model Imports -----------------------
// Import all models here so sequelize.sync() creates their tables
// Every new model you add must be registered here

const Employee = require('./src/models/Employee');
const Roster   = require('./src/models/Roster');
const AttendanceLog = require('./src/models/AttendanceLog'); // Each punch card swipe from IoT or manual entry
const Attendance = require('./src/models/Attendance');    // final calculated attendance record per employee per day
const LeaveRequest = require('./src/models/LeaveRequest'); // employee-submitted leave requests awaiting review

// ----------------------- Model Routes -----------------------
const employeeRoutes = require('./src/routes/employeeRoute');
const rosterRoutes = require('./src/routes/rosterRoute');
const attendanceLogRoutes = require('./src/routes/attendanceLogRoute');
const attendanceRoutes = require('./src/routes/attendanceRoute');
const leaveRequestRoutes = require('./src/routes/leaveRequestRoute');
const authRoutes     = require('./src/routes/authRoute');

// ----------------------- Error Logging Middleware -----------------------
const requestLogger = require('./src/middleware/requestLogger'); 
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

app.use(requestLogger); //logs method, route, status code, response time

// ----------------------- Routes -----------------------
app.use('/auth',     authRoutes);      // POST /auth/login, POST /auth/logout, GET /auth/me

// Mount employee routes under /employee (canonical API path)
app.use('/employee', employeeRoutes);
// Plural alias — common mistake /employees should not hard-404
app.use('/employees', employeeRoutes);

// Mount roster routes under /roster
app.use('/roster', rosterRoutes);

// Mount attendance log routes under /attendance-log
app.use('/attendance-log', attendanceLogRoutes);

// Mount attendance routes under /attendance
app.use('/attendance', attendanceRoutes);

// Mount leave request routes under /leave
app.use('/leave', leaveRequestRoutes);

// ----------------------- Error Handlers -----------------------
// Must be registered AFTER all routes so they only catch unmatched/errored requests
app.use(notFoundLogger);  // 404 - route not found
app.use(errorLogger);     // 500 - unhandled errors from controllers

// Use PORT from .env or fallback
const PORT = process.env.PORT || 5000;

// Step 1 - test the database connection
sequelize.authenticate()

    // Step 2 - create tables on a fresh DB, or migrate password on an existing one
    // Password must be backfilled before sync enforces NOT NULL on existing rows.
    .then(async () => {
        console.log('');
        console.log('-------------------------------------------------------');
        console.log('Neon database connected successfully.');

        const tables = await sequelize.getQueryInterface().showAllTables();
        const tableNames = tables.map((t) => (
            typeof t === 'string' ? t : (t.tableName || t.name || '')
        ).toLowerCase());
        const hasEmployees = tableNames.includes('employees');

        if (!hasEmployees) {
            // Fresh database — create all tables from models first
            await sequelize.sync({ alter: true });
            return;
        }

        await sequelize.query(`
            ALTER TABLE employees
            ADD COLUMN IF NOT EXISTS password VARCHAR(255);
        `);

        const [results] = await sequelize.query(`
            SELECT COUNT(*)::int AS count
            FROM employees
            WHERE password IS NULL OR password = '';
        `);
        const missingCount = results[0]?.count ?? 0;
        if (missingCount > 0) {
            const bcrypt = require('bcrypt');
            const placeholderHash = await bcrypt.hash('ChangeMe123!', 10);
            await sequelize.query(
                `UPDATE employees SET password = :hash WHERE password IS NULL OR password = '';`,
                { replacements: { hash: placeholderHash } },
            );
            console.log(`Backfilled password for ${missingCount} employee(s) with temporary default.`);
        }

        await sequelize.query(`
            ALTER TABLE employees
            ALTER COLUMN password SET NOT NULL;
        `);

        // alter: true updates existing tables safely without deleting data
        await sequelize.sync({ alter: true });
    })

    // Step 4 - apply known schema patches (sync alter alone is unreliable on PostgreSQL)
    .then(() => sequelize.query(`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS roster BOOLEAN NOT NULL DEFAULT false;
    `))
    .then(() => sequelize.query(`
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
    `))
    .then(() => sequelize.query(`
        ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS late_cover_minutes INTEGER NOT NULL DEFAULT 0;
    `))
    .then(() => sequelize.query(`
        ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0;
    `))
    .then(() => sequelize.query(`
        DO $$ BEGIN
            CREATE TYPE "enum_attendance_dayType" AS ENUM ('full_day', 'short_leave', 'half_day');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    `))
    .then(() => sequelize.query(`
        ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS "dayType" "enum_attendance_dayType";
    `))

    // RBAC: employees.role enum previously only had 'admin' and 'employee'.
    // ALTER TYPE ... ADD VALUE cannot run inside the implicit sync transaction
    // and errors if the value already exists, so each is its own statement
    // guarded by a catch that ignores "already exists" (duplicate_object).
    .then(() => sequelize.query(`ALTER TYPE "enum_employees_role" ADD VALUE IF NOT EXISTS 'super-admin';`).catch(() => {}))
    .then(() => sequelize.query(`ALTER TYPE "enum_employees_role" ADD VALUE IF NOT EXISTS 'manager';`).catch(() => {}))
    .then(() => sequelize.query(`ALTER TYPE "enum_employees_role" ADD VALUE IF NOT EXISTS 'admin-manager';`).catch(() => {}))

    // Step 5 - start the server only after the database is ready
    .then(() => {
        console.log('-------------------------------------------------------');
        console.log('Models synced with the database.');
        app.listen(PORT, () => {
            console.log('-------------------------------------------------------');
            console.log(`Server running on http://localhost:${PORT}`);
            console.log('-------------------------------------------------------');
            console.log('');
        });
    })

    // If connection or sync fails, log the error and stop the process
    .catch((err) => {
        console.error('Database connection failed:', err);
        process.exit(1); // exit with error code - no point running without a database
    });