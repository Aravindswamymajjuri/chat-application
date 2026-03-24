const express = require('express');
const router = express.Router();
const callHistoryController = require('../controllers/callHistoryController');

// Save a call record
router.post('/save', callHistoryController.saveCall);

// Get call history for a user
router.get('/user/:username', callHistoryController.getCallHistory);

// Get call history between two users
router.get('/between/:username/:otherUsername', callHistoryController.getCallHistoryWith);

// Delete specific call from history
router.delete('/:callId', callHistoryController.deleteCallHistory);

// Clear all call history for a user
router.delete('/user/:username/clear', callHistoryController.clearCallHistory);

module.exports = router;
