const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/update-fcm-token', authController.updateFCMToken);
router.post('/set-app-lock', authController.setAppLockPassword);
router.post('/verify-app-lock', authController.verifyAppLockPassword);
router.get('/check-app-lock', authController.checkAppLock);
router.post('/toggle-app-lock', authController.toggleAppLock);

module.exports = router;
