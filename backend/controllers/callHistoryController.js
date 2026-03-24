const CallHistory = require('../models/CallHistory');

// Save a call record
exports.saveCall = async (req, res) => {
  try {
    const { callerId, receiverId, duration, status, networkQuality } = req.body;

    if (!callerId || !receiverId) {
      return res.status(400).json({ message: 'callerId and receiverId are required' });
    }

    const callRecord = new CallHistory({
      callerId,
      receiverId,
      duration: duration || 0,
      status: status || 'completed',
      endTime: new Date(),
      networkQuality: networkQuality || 'good'
    });

    await callRecord.save();
    res.status(201).json({ 
      message: 'Call recorded',
      call: callRecord
    });
  } catch (error) {
    console.error('Error saving call:', error);
    res.status(500).json({ message: 'Error saving call', error: error.message });
  }
};

// Get call history for a user
exports.getCallHistory = async (req, res) => {
  try {
    const { username } = req.params;
    const limit = req.query.limit || 50;

    if (!username) {
      return res.status(400).json({ message: 'username is required' });
    }

    // Get calls where user is caller OR receiver
    const calls = await CallHistory.find({
      $or: [
        { callerId: username },
        { receiverId: username }
      ]
    })
      .sort({ startTime: -1 })
      .limit(parseInt(limit));

    res.json({
      username,
      callCount: calls.length,
      calls
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({ message: 'Error fetching call history', error: error.message });
  }
};

// Get call history between two users
exports.getCallHistoryWith = async (req, res) => {
  try {
    const { username, otherUsername } = req.params;
    const limit = req.query.limit || 50;

    if (!username || !otherUsername) {
      return res.status(400).json({ message: 'username and otherUsername are required' });
    }

    const calls = await CallHistory.find({
      $or: [
        { callerId: username, receiverId: otherUsername },
        { callerId: otherUsername, receiverId: username }
      ]
    })
      .sort({ startTime: -1 })
      .limit(parseInt(limit));

    res.json({
      between: [username, otherUsername],
      callCount: calls.length,
      calls
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({ message: 'Error fetching call history', error: error.message });
  }
};

// Delete call history
exports.deleteCallHistory = async (req, res) => {
  try {
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ message: 'callId is required' });
    }

    await CallHistory.findByIdAndDelete(callId);
    res.json({ message: 'Call history deleted' });
  } catch (error) {
    console.error('Error deleting call history:', error);
    res.status(500).json({ message: 'Error deleting call history', error: error.message });
  }
};

// Clear all call history for a user
exports.clearCallHistory = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ message: 'username is required' });
    }

    const result = await CallHistory.deleteMany({
      $or: [
        { callerId: username },
        { receiverId: username }
      ]
    });

    res.json({ 
      message: 'Call history cleared',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error clearing call history:', error);
    res.status(500).json({ message: 'Error clearing call history', error: error.message });
  }
};
