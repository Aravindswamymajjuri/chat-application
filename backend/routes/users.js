const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

router.get('/all', usersController.getAllUsers);
router.get('/:userId', usersController.getUserById);
router.put('/status', usersController.updateOnlineStatus);

// Unread message count routes
router.get('/:userId/unread-counts', usersController.getUnreadCounts);
router.post('/unread-counts/clear', usersController.clearUnreadCount);
router.post('/unread-counts/increment', usersController.incrementUnreadCount);

module.exports = router;
