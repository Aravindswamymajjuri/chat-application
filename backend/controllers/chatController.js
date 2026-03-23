const Message = require('../models/Message');
const User = require('../models/User');

exports.getMessages = async (req, res) => {
  try {
    const { sender, receiver } = req.query;

    if (!sender || !receiver) {
      return res.status(400).json({ message: 'sender and receiver required' });
    }

    // Get all messages between two users (both directions)
    const messages = await Message.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender }
      ]
    }).sort({ timestamp: 1 });

    // Filter out messages that are deleted for current user
    const filteredMessages = messages.map(msg => {
      if (msg.deletedFor && msg.deletedFor.includes(sender)) {
        return {
          ...msg.toObject(),
          text: '[Deleted message]',
          deletedForMe: true
        };
      }
      return msg;
    });

    res.status(200).json(filteredMessages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
};

exports.saveMessage = async (req, res) => {
  try {
    const { sender, receiver, text, replyTo } = req.body;

    if (!sender || !receiver || !text) {
      return res.status(400).json({ message: 'sender, receiver, and text required' });
    }

    const message = new Message({
      sender,
      receiver,
      text,
      timestamp: new Date(),
      replyTo: replyTo || null
    });

    await message.save();

    // Convert Mongoose document to plain object to ensure proper JSON serialization
    const messageObject = message.toObject();
    res.status(201).json({ message: 'Message saved successfully', data: messageObject });
  } catch (error) {
    res.status(500).json({ message: 'Error saving message', error: error.message });
  }
};

// Delete message for everyone
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({ message: 'messageId required' });
    }

    const result = await Message.findByIdAndDelete(messageId);

    if (!result) {
      return res.status(404).json({ message: 'Message not found' });
    }

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
};

// Delete message for current user only
exports.deleteMessageForMe = async (req, res) => {
  try {
    const { messageId, username } = req.body;

    if (!messageId || !username) {
      return res.status(400).json({ message: 'messageId and username required' });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Add username to deletedFor array if not already present
    if (!message.deletedFor.includes(username)) {
      message.deletedFor.push(username);
      await message.save();
    }

    res.status(200).json({ message: 'Message deleted for you', data: message });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
};
