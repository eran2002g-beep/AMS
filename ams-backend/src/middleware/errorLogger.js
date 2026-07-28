// src/middleware/errorLogger.js
// Global error-logging middleware for the AMS backend.

// HOW IT WORKS:
//   Express recognises a function with FOUR parameters (err, req, res, next)
//   as an error-handling middleware.  Any route or controller that calls
//   next(err) — or throws inside an async handler — will land here.

// WHAT IT LOGS:
//   * Timestamp of the error
//   * HTTP method + URL that triggered the error
//   * HTTP status code that will be sent back
//   * Error message
//   * Full stack trace for server errors (5xx) only
//   * Request body (helpful to reproduce the problem)
//   * Request headers (useful for CORS / auth debugging)

// REGISTRATION:
//   This middleware must be the LAST app.use() call in server.js, after all routes.
//   Express only passes control here when a route or controller explicitly calls next(err) or throws an error.


const errorLogger = (err, req, res, next) => {
    // ----------------------- Determine HTTP status -----------------------
    // Use the status already attached to the error, or default to 500
    const status = err.status || err.statusCode || 500;
    const isClientError = status >= 400 && status < 500;

    // ----------------------- Console output -----------------------
    // 4xx = expected client mistakes (quiet). 5xx = real server faults (full dump).
    if (isClientError) {
        console.warn('');
        console.warn('-------------------------------------------------------');
        console.warn(` CLIENT ERROR  [${new Date().toISOString()}]`);
        console.warn('-------------------------------------------------------');
        console.warn(`   Route   : ${req.method} ${req.originalUrl}`);
        console.warn(`   Status  : ${status}`);
        console.warn(`   Message : ${err.message}`);
        console.warn('-------------------------------------------------------');
        console.warn('');
    } else {
        console.error('');
        console.error('-------------------------------------------------------');
        console.error(` BACKEND ERROR  [${new Date().toISOString()}]`);
        console.error('-------------------------------------------------------');
        console.error(`   Route   : ${req.method} ${req.originalUrl}`);
        console.error(`   Status  : ${status}`);
        console.error(`   Message : ${err.message}`);

        if (err.stack) {
            console.error('');
            console.error('   Stack Trace:');
            err.stack.split('\n').forEach(line => console.error(`   ${line}`));
        }

        if (req.body && Object.keys(req.body).length > 0) {
            console.error('');
            console.error('   Request Body:');
            try {
                console.error('  ', JSON.stringify(req.body, null, 2));
            } catch {
                console.error('   [Unable to serialize request body]');
            }
        }

        const usefulHeaders = ['origin', 'content-type', 'authorization'];
        const loggedHeaders = {};
        usefulHeaders.forEach(h => {
            if (req.headers[h]) loggedHeaders[h] = req.headers[h];
        });
        if (Object.keys(loggedHeaders).length > 0) {
            console.error('');
            console.error('   Request Headers:');
            Object.entries(loggedHeaders).forEach(([k, v]) =>
                console.error(`     ${k}: ${v}`)
            );
        }

        console.error('-------------------------------------------------------');
        console.error('');
    }

    // ----------------------- HTTP response -----------------------
    // Avoid double-send if a handler already replied.
    if (res.headersSent) {
        return next(err);
    }

    const clientMessage = isClientError
        ? (err.message || 'Request could not be completed.')
        : (process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : (err.message || 'Internal Server Error'));

    res.status(status).json({
        success: false,
        status,
        message: clientMessage,
        // Only expose the stack for server errors in non-production
        ...(!isClientError && process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};

// 404 Not-Found handler
//    Register this BEFORE errorLogger but AFTER all routes in server.js.
//    Responds directly — no stack dump for unknown routes.
const notFoundLogger = (req, res) => {
    console.warn('');
    console.warn('-------------------------------------------------------');
    console.warn(` 404 NOT FOUND  [${new Date().toISOString()}]`);
    console.warn('-------------------------------------------------------');
    console.warn(`   Route   : ${req.method} ${req.originalUrl}`);
    if (req.headers['origin']) {
        console.warn(`   Origin  : ${req.headers['origin']}`);
    }
    console.warn('-------------------------------------------------------');
    console.warn('');

    if (res.headersSent) return;

    res.status(404).json({
        success: false,
        status: 404,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};

module.exports = { errorLogger, notFoundLogger };
