// src/middleware/requestLogger.js - logs every incoming API request to the console
// shows method, route, status code and response time for every request

const morgan = require('morgan');

// ----------------------- CUSTOM TOKENS -----------------------

// colored-status - adds color to the HTTP status code in the console
// green = 2xx success, yellow = 4xx client error, red = 5xx server error
morgan.token('colored-status', (req, res) => {
    const status = res.statusCode;

    if (status >= 500) return `\x1b[31m${status}\x1b[0m`; // red    - server error
    if (status >= 400) return `\x1b[33m${status}\x1b[0m`; // yellow - client error
    if (status >= 300) return `\x1b[36m${status}\x1b[0m`; // cyan   - redirect
    if (status >= 200) return `\x1b[32m${status}\x1b[0m`; // green  - success
    return status;
});

// colored-method - adds color to the HTTP method in the console
morgan.token('colored-method', (req) => {
    const method = req.method;

    const colors = {
        GET    : '\x1b[32m',  // green
        POST   : '\x1b[34m',  // blue
        PUT    : '\x1b[33m',  // yellow
        PATCH  : '\x1b[35m',  // magenta
        DELETE : '\x1b[31m',  // red
    };

    const color = colors[method] || '\x1b[0m';
    return `${color}${method}\x1b[0m`;
});

// ----------------------- FORMAT -----------------------
// what prints in the console for every request:
// e.g.  POST /auth/login 200 - 45 ms
//       GET  /employee   404 - 12 ms
const requestLogger = morgan(
    ':colored-method :url :colored-status - :response-time ms'
);

module.exports = requestLogger;