const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
router.post('/login', authController.login);

module.exports = router;