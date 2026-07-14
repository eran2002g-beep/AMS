// src/routes/authRoute.js - maps auth endpoints to their controller functions
// mounted in server.js under /auth so full paths are /auth/login and /auth/logout

const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /auth/login - public route, no token needed
// body: { email, password }
router.post('/login', authController.login);

// POST /auth/logout - protected route, token required to confirm valid session
// verifyToken runs first to confirm the user is actually logged in before logging out
router.post('/logout', verifyToken, authController.logout);

module.exports = router;