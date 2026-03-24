const mongoose = require('mongoose');

const callHistorySchema = new mongoose.Schema({
  callerId: {
    type: String,
    required: true
  },
  receiverId: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  status: {
    type: String,
    enum: ['completed', 'missed', 'rejected'],
    default: 'completed'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  networkQuality: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  }
});

// Index for faster queries
callHistorySchema.index({ callerId: 1, startTime: -1 });
callHistorySchema.index({ receiverId: 1, startTime: -1 });

module.exports = mongoose.model('CallHistory', callHistorySchema);
