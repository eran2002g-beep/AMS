// src/routes/authRoute.js - maps auth endpoints to their controller functions
// mounted in server.js under /auth so full paths are /auth/login and /auth/logout

const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /auth/login - public route, no token needed
// body: { email, password }
router.post('/login', authController.login);

// Refresh and logout authenticate with the HttpOnly refresh-token cookie.
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// GET /auth/me - return the logged-in employee's full profile
// requires a valid Bearer access token
router.get('/me', verifyToken, authController.getMe);

module.exports = router;