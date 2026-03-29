const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

// Static routes FIRST (before parameterized :userId routes)
router.get('/all', usersController.getAllUsers);
router.put('/status', usersController.updateOnlineStatus);
router.post('/unread-counts/clear', usersController.clearUnreadCount);
router.post('/unread-counts/increment', usersController.incrementUnreadCount);

// Parameterized routes LAST
router.get('/:userId/unread-counts', usersController.getUnreadCounts);
router.get('/:userId', usersController.getUserById);

module.exports = router;
