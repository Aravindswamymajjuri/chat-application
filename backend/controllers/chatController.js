const Message = require('../models/Message');
const User = require('../models/User');

// Middleware to inject io into controller
let io = null;
let connectedUsers = null; // Will be set by server.js

exports.setIO = (socketIO, users) => {
  io = socketIO;
  connectedUsers = users;
};

exports.getMessages = async (req, res) => {
  try {
    const { sender, receiver } = req.query;

    if (!sender || !receiver) {
      return res.status(400).json({ message: 'sender and receiver required' });
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📋 getMessages called`);
    console.log(`   Current user (reader): ${sender}`);
    console.log(`   Viewing messages from: ${receiver}`);
    
    // Mark all messages from receiver to sender as "seen"
    const result = await Message.updateMany(
      {
        sender: receiver,
        receiver: sender,
        status: { $in: ['sent', 'delivered'] } // Only mark unseen messages
      },
      {
        $set: { status: 'seen' }
      }
    );

    console.log(`   Marked ${result.modifiedCount} messages as seen`);

    // Emit socket event to notify the sender that their messages were seen
    if (io && result.modifiedCount > 0) {
      const senderSocketId = connectedUsers?.[receiver];
      
      const messageData = {
        sender: receiver,
        receiver: sender,
        count: result.modifiedCount
      };
      
      console.log(`\n📤 Emitting message-seen event to ${receiver}`);
      
      // Try multiple delivery methods
      if (senderSocketId) {
        io.to(senderSocketId).emit('message-seen', messageData);
        console.log(`   ✅ [DIRECT] Emitted to socket`);
      }
      
      io.to(`user_${receiver}`).emit('message-seen', messageData);
      console.log(`   ✅ [ROOM] Emitted to user_${receiver} room`);
      
      console.log(`${'='.repeat(70)}\n`);
    }

    // Get all messages between two users
    const messages = await Message.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender }
      ]
    }).sort({ timestamp: 1 });

    console.log(`📨 Returning ${messages.length} messages`);

    // Convert to plain objects with proper field serialization
    const filteredMessages = messages.map(msg => {
      const msgObj = {
        _id: msg._id,
        sender: msg.sender,
        receiver: msg.receiver,
        text: msg.text,
        timestamp: msg.timestamp,
        status: msg.status || 'sent', // Default to sent if not set
        deletedFor: msg.deletedFor || [],
        replyTo: msg.replyTo || null
      };
      
      // Apply deletion if applicable
      if (msg.deletedFor && msg.deletedFor.includes(sender)) {
        msgObj.text = '[Deleted message]';
        msgObj.deletedForMe = true;
      }
      
      return msgObj;
    });

    res.status(200).json(filteredMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
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
