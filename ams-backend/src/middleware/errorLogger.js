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
//   * Full stack trace (so you can pin-point the exact file & line)
//   * Request body (helpful to reproduce the problem)
//   * Request headers (useful for CORS / auth debugging)

// REGISTRATION:
//   This middleware must be the LAST app.use() call in server.js, after all routes.  
//   Express only passes control here when a route or controller explicitly calls next(err) or throws an error.


const errorLogger = (err, req, res, next) => {
    // ----------------------- Determine HTTP status -----------------------
    // Use the status already attached to the error, or default to 500
    const status = err.status || err.statusCode || 500;

    // ----------------------- Console output -----------------------
    console.error('');
    console.error('-------------------------------------------------------');
    console.error(` BACKEND ERROR  [${new Date().toISOString()}]`);
    console.error('-------------------------------------------------------');
    console.error(`   Route   : ${req.method} ${req.originalUrl}`);
    console.error(`   Status  : ${status}`);
    console.error(`   Message : ${err.message}`);

    // Stack trace (most useful for debugging)
    if (err.stack) {
        console.error('');
        console.error('   Stack Trace:');
        err.stack.split('\n').forEach(line => console.error(`   ${line}`));
    }

    // Request body (skip for file uploads to avoid noise)
    if (req.body && Object.keys(req.body).length > 0) {
        console.error('');
        console.error('   Request Body:');
        try {
            console.error('  ', JSON.stringify(req.body, null, 2));
        } catch {
            console.error('   [Unable to serialize request body]');
        }
    }

    // Selected headers (Origin helps with CORS debugging)
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

    // ----------------------- HTTP response -----------------------
    // Send a clean JSON error back to the frontend so it knows what happened
    res.status(status).json({
        success: false,
        status,
        message: err.message || 'Internal Server Error',
        // Only expose the stack in development so production stays safe
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

// 404 Not-Found handler
//    Register this BEFORE errorLogger but AFTER all routes in server.js.
//    It catches requests that didn't match any route and turns them into a proper error so errorLogger can print them.

const notFoundLogger = (req, res, next) => {
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

    const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
    err.status = 404;
    next(err); // forward to errorLogger
};

module.exports = { errorLogger, notFoundLogger };
