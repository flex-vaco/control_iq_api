const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const schemas = require('../validations/schemas');

router.post('/login', validate(schemas.login), authController.login);
router.get('/me', authController.me);
router.post('/logout', authController.logout);

module.exports = router;
